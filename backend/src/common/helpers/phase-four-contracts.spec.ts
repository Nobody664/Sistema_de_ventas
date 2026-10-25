import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { PlatformFinanceService } from "@/modules/platform/platform-finance.service";
import { UpdatePlatformAccountDto } from "@/modules/platform/dto/platform-finance.dto";
import { ProductsService } from "@/modules/products/products.service";
import { CompaniesService } from "@/modules/companies/companies.service";
import { optionalDate } from "./patch-contract.helper";

describe("Phase four public contracts", () => {
  it("rejects company-wide notification reads by a cashier or a different tenant before querying data", async () => {
    const service = new NotificationsService({} as PrismaService);
    await assert.rejects(
      service.findByCompany(
        "company",
        {},
        {
          sub: "cashier",
          email: "u@example.invalid",
          companyId: "company",
          roles: ["CASHIER"],
        },
      ),
      ForbiddenException,
    );
    await assert.rejects(
      service.findByCompany(
        "company",
        {},
        {
          sub: "admin",
          email: "u@example.invalid",
          companyId: "other",
          roles: ["COMPANY_ADMIN"],
        },
      ),
      ForbiddenException,
    );
  });
  it("treats undefined as omission, validates real calendar dates and only permits nullable date deletion", () => {
    assert.equal(optionalDate(undefined), undefined);
    assert.equal(optionalDate(null), null);
    assert.throws(() => optionalDate(null, false), BadRequestException);
    assert.throws(() => optionalDate("2026-02-31"), BadRequestException);
    assert.throws(
      () => optionalDate("https://example.invalid/execute"),
      BadRequestException,
    );
    assert.equal(
      optionalDate("2026-02-28")?.toISOString(),
      "2026-02-28T00:00:00.000Z",
    );
  });
  it("rejects null initial balances in both DTO validation and direct service calls", async () => {
    const dto = plainToInstance(UpdatePlatformAccountDto, {
      initialBalance: null,
    });
    assert.ok((await validate(dto)).length > 0);
    await assert.rejects(
      new PlatformFinanceService({} as PrismaService).updateAccount(
        "account",
        dto,
      ),
      BadRequestException,
    );
  });
  it("does not reactivate a product on a partial edit and preserves explicit category deletion", async () => {
    let data: Record<string, unknown> | undefined;
    const product = {
      id: "product",
      name: "P",
      sku: "SKU",
      salePrice: new Prisma.Decimal(1),
      stockQuantity: new Prisma.Decimal(2),
      minStock: new Prisma.Decimal(1),
      isActive: false,
    };
    const prisma = {
      product: {
        findFirst: async () => product,
        updateMany: async (args: { data: Record<string, unknown> }) => {
          data = args.data;
          return { count: 1 };
        },
      },
    } as unknown as PrismaService;
    await new ProductsService(
      prisma,
      {} as never,
      {} as never,
      { log: async () => undefined } as never,
    ).updateProduct("company", "product", {
      name: "Updated",
      categoryId: null,
    });
    assert.equal(data?.isActive, undefined);
    assert.equal(data?.deletedAt, undefined);
    assert.equal(data?.categoryId, null);
  });
  it("recalculates company profile completeness from the complete merged state, not only the patch", async () => {
    let data: Record<string, unknown> | undefined;
    const completedAt = new Date("2026-01-01");
    const company = {
      id: "company",
      name: "Company",
      legalName: "Company SAC",
      taxId: "20123456789",
      email: "owner@example.invalid",
      address: "Avenida Principal 123",
      phone: "+51987654321",
      profileCompletedAt: completedAt,
    };
    const prisma = {
      company: {
        findUnique: async () => company,
        update: async (args: { data: Record<string, unknown> }) => {
          data = args.data;
          return company;
        },
      },
    } as unknown as PrismaService;
    const service = new CompaniesService(prisma);
    await service.updateCurrent("company", { name: "Renamed" });
    assert.equal(data?.profileComplete, true);
    assert.equal(data?.profileCompletedAt, completedAt);
    await service.updateCurrent("company", { email: null });
    assert.equal(data?.profileComplete, false);
    assert.equal(data?.profileCompletedAt, null);
  });
  it("deduplicates persisted notifications and avoids a second SSE publication on retry", async () => {
    let stored: unknown = null;
    let writes = 0;
    let published = 0;
    const prisma = {
      notification: {
        findUnique: async () => stored,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          writes++;
          stored = { id: "notification", ...data };
          return stored;
        },
      },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma);
    service.subscribe("user", () => {
      published++;
    });
    await service.create({
      userId: "user",
      type: "GENERAL",
      title: "Title",
      message: "Message",
      dedupeKey: "event:user",
    });
    await service.create({
      userId: "user",
      type: "GENERAL",
      title: "Title",
      message: "Message",
      dedupeKey: "event:user",
    });
    assert.equal(writes, 1);
    assert.equal(published, 1);
  });
});
