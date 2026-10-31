import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { DataExportService } from "./data-export.service";
import {
  exportCollections,
  validateExportDefinitions,
} from "./data-export.collections";

const user = {
  sub: "owner",
  email: "owner@example.test",
  companyId: "company-a",
  roles: ["COMPANY_ADMIN"],
};
const query = () => ({ startedAt: new Date().toISOString() });

function fixture() {
  const calls: Array<{
    where: Record<string, unknown>;
    select: Record<string, true>;
    take: number;
  }> = [];
  const membership = { isActive: true, role: "COMPANY_ADMIN" };
  let rows: Array<{ id: string; value?: unknown }> = [];
  const findMany = async (args: (typeof calls)[number]) => {
    calls.push(args);
    return rows;
  };
  const prisma = {
    membership: {
      findUnique: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, {
          userId_companyId: { userId: user.sub, companyId: user.companyId },
        });
        return membership;
      },
    },
    company: {
      findUniqueOrThrow: async ({
        where,
        select,
      }: {
        where: unknown;
        select: Record<string, boolean>;
      }) => {
        assert.deepEqual(where, { id: user.companyId });
        assert.equal(select.memberships, undefined);
        return { id: user.companyId, name: "Negocio" };
      },
    },
    product: { findMany },
    saleItem: { findMany },
    distributorStock: { findMany },
  };
  const service = new DataExportService(prisma as unknown as PrismaService);
  return {
    service,
    calls,
    membership,
    setRows: (value: typeof rows) => {
      rows = value;
    },
  };
}

describe("Business data export", () => {
  it("uses a closed schema projection without credentials or platform tables", () => {
    validateExportDefinitions();
    const forbidden = /password|token|secret|fingerprint|operationKey/i;
    for (const definition of Object.values(exportCollections)) {
      assert.ok(
        ![
          "User",
          "RefreshToken",
          "PlatformSetting",
          "Payment",
          "Membership",
        ].includes(definition.model),
      );
      assert.ok(!definition.fields.some((field) => forbidden.test(field)));
    }
  });
  it("exports the authenticated company manifest with explicit version and exclusions", async () => {
    const { service } = fixture();
    const result = await service.manifest(user);
    assert.equal(result.company.id, user.companyId);
    assert.equal(result.version, 1);
    assert.ok(result.collections.includes("saleItems"));
    assert.ok(result.excluded.includes("sessions"));
  });
  it("rejects inactive memberships, operational roles and global administrators", async () => {
    const { service, membership } = fixture();
    for (const roles of [
      ["CASHIER"],
      ["MANAGER"],
      ["SUPER_ADMIN", "COMPANY_ADMIN"],
      ["SUPPORT_ADMIN"],
    ])
      await assert.rejects(
        service.manifest({ ...user, roles }),
        ForbiddenException,
      );
    membership.isActive = false;
    await assert.rejects(service.manifest(user), ForbiddenException);
  });
  it("paginates with a tenant filter and creation cutoff without depending on a deleted cursor row", async () => {
    const { service, calls, setRows } = fixture();
    setRows(Array.from({ length: 501 }, (_, index) => ({ id: `p${index}` })));
    const input = { ...query(), after: "deleted-product" };
    const result = await service.page(user, "products", input);
    assert.equal(result.rows.length, 500);
    assert.equal(result.nextCursor, "p499");
    assert.deepEqual(calls[0].where, {
      companyId: user.companyId,
      createdAt: { lte: new Date(input.startedAt) },
      id: { gt: input.after },
    });
    assert.equal(calls[0].select.salePrice, true);
  });
  it("scopes child records through their tenant-owned parent and preserves exact decimals", async () => {
    const { service, calls, setRows } = fixture();
    setRows([{ id: "item", value: new Prisma.Decimal("900719925474.1234") }]);
    const result = await service.page(user, "saleItems", query());
    assert.deepEqual(calls[0].where.sale, { companyId: user.companyId });
    assert.match(JSON.stringify(result), /"900719925474.1234"/);
  });
  it("rejects unknown collections and expired exports before reading data", async () => {
    const { service, calls } = fixture();
    for (const name of ["user", "__proto__", "constructor", "refreshToken"])
      await assert.rejects(
        service.page(user, name, query()),
        BadRequestException,
      );
    await assert.rejects(
      service.page(user, "products", { startedAt: "2000-01-01T00:00:00Z" }),
      BadRequestException,
    );
    assert.equal(calls.length, 0);
  });
  it("scopes both sides of distributor stock and advances the compound key", async () => {
    const { service, calls } = fixture();
    await service.page(user, "distributorStocks", {
      ...query(),
      after: "dist-a:product-a",
    });
    assert.equal(
      (calls[0].where.distributor as { companyId: string }).companyId,
      user.companyId,
    );
    assert.equal(
      (calls[0].where.product as { companyId: string }).companyId,
      user.companyId,
    );
    assert.deepEqual(calls[0].where.OR, [
      { distributorId: { gt: "dist-a" } },
      { distributorId: "dist-a", productId: { gt: "product-a" } },
    ]);
  });
});
