import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PrismaService } from "@/database/prisma/prisma.service";
import { ApiQuotaService } from "@/modules/plan-capabilities/api-quota.service";
import { ApiKeysService, hashApiKey } from "./api-keys.service";
import { IntegrationOwnerService } from "./integration-owner.service";
import { CreateApiKeyDto } from "./dto/api-key.dto";

function fixture() {
  const id = randomUUID();
  const value = `vsk_${id}.${randomBytes(32).toString("base64url")}`;
  const key = {
    id,
    companyId: "company-a",
    keyHash: hashApiKey(value),
    revokedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 60000),
    scopes: ["catalog.read"],
    company: { status: "ACTIVE" },
    membership: {
      companyId: "company-a",
      isActive: true,
      role: "COMPANY_ADMIN",
      user: { isActive: true },
    },
  };
  const state = { consumed: 0, writes: 0, touched: 1 };
  const user = {
    sub: "owner",
    email: "owner@example.test",
    companyId: "company-a",
    roles: ["COMPANY_ADMIN"],
  };
  let inserted: Record<string, unknown> | undefined;
  const prisma = {
    membership: {
      findUnique: async () => ({
        id: "membership-a",
        isActive: true,
        role: "COMPANY_ADMIN",
      }),
    },
    companyApiKey: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === id ? key : null,
      findFirst: async ({
        where,
      }: {
        where: { id: string; companyId: string };
      }) => (where.id === id && where.companyId === key.companyId ? key : null),
      count: async () => 0,
      create: async ({
        data,
        select,
      }: {
        data: Record<string, unknown>;
        select: Record<string, boolean>;
      }) => {
        inserted = data;
        state.writes++;
        return Object.fromEntries(
          Object.entries(data).filter(([name]) => select[name]),
        );
      },
      updateMany: async () => ({ count: state.touched }),
      update: async () => {
        state.writes++;
        key.revokedAt = new Date();
        return { id, revokedAt: key.revokedAt };
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assert.equal(JSON.stringify(data).includes(value), false);
        return data;
      },
    },
    $transaction: async <T>(work: (tx: unknown) => Promise<T>) => work(prisma),
  };
  const owners = new IntegrationOwnerService(
    prisma as unknown as PrismaService,
  );
  const quota = {
    assertAccess: async () => {},
    consume: async (companyId: string) => {
      assert.equal(companyId, "company-a");
      state.consumed++;
    },
  };
  const service = new ApiKeysService(
    prisma as unknown as PrismaService,
    owners,
    quota as unknown as ApiQuotaService,
  );
  return {
    service,
    owners,
    user,
    key,
    value,
    state,
    getInserted: () => inserted,
  };
}

describe("Read-only API credentials", () => {
  it("stores only a SHA-256 digest while returning a random one-time credential and scoped metadata", async () => {
    const { service, user, getInserted } = fixture();
    const response = await service.create(user, {
      name: "Catálogo",
      scopes: ["catalog.read"],
    });
    assert.match(response.key, /^vsk_[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/);
    assert.equal(getInserted()?.keyHash, hashApiKey(response.key));
    assert.equal(Object.values(getInserted()!).includes(response.key), false);
    assert.equal("keyHash" in response, false);
    assert.deepEqual(response.scopes, ["catalog.read"]);
  });
  it("requires the exact key, active membership, allowed scope and available quota", async () => {
    const { service, value, state } = fixture();
    const result = await service.authenticate(value, "catalog.read");
    assert.equal(result.companyId, "company-a");
    assert.equal(state.consumed, 1);
    await assert.rejects(
      service.authenticate(value, "sales.read"),
      ForbiddenException,
    );
    await assert.rejects(
      service.authenticate(
        value.slice(0, -1) + (value.endsWith("A") ? "B" : "A"),
        "catalog.read",
      ),
      UnauthorizedException,
    );
    assert.equal(state.consumed, 1);
  });
  it("denies revoked, expired and disabled-company keys before consuming quota", async () => {
    for (const mutate of [
      (key: ReturnType<typeof fixture>["key"]) => {
        key.revokedAt = new Date();
      },
      (key: ReturnType<typeof fixture>["key"]) => {
        key.expiresAt = new Date(0);
      },
      (key: ReturnType<typeof fixture>["key"]) => {
        key.company.status = "SUSPENDED";
      },
      (key: ReturnType<typeof fixture>["key"]) => {
        key.membership.isActive = false;
      },
      (key: ReturnType<typeof fixture>["key"]) => {
        key.membership.user.isActive = false;
      },
      (key: ReturnType<typeof fixture>["key"]) => {
        key.membership.companyId = "company-b";
      },
      (key: ReturnType<typeof fixture>["key"]) => {
        key.membership.role = "CASHIER";
      },
    ]) {
      const { service, key, value, state } = fixture();
      mutate(key);
      await assert.rejects(service.authenticate(value, "catalog.read"));
      assert.equal(state.consumed, 0);
    }
  });
  it("does not accept a key revoked during authentication", async () => {
    const { service, value, state } = fixture();
    state.touched = 0;
    await assert.rejects(
      service.authenticate(value, "catalog.read"),
      UnauthorizedException,
    );
  });
  it("cannot revoke a foreign company's key and revocation immediately invalidates a valid key", async () => {
    const { service, user, key, value, state } = fixture();
    key.companyId = "company-b";
    await assert.rejects(service.revoke(user, key.id), NotFoundException);
    assert.equal(state.writes, 0);
    key.companyId = "company-a";
    await service.revoke(user, key.id);
    await assert.rejects(
      service.authenticate(value, "catalog.read"),
      UnauthorizedException,
    );
  });
  it("rejects global and operational actors from key management", async () => {
    const { owners, user } = fixture();
    for (const roles of [
      ["SUPER_ADMIN", "COMPANY_ADMIN"],
      ["SUPPORT_ADMIN"],
      ["CASHIER"],
      ["MANAGER"],
    ])
      await assert.rejects(
        owners.require({ ...user, roles }),
        ForbiddenException,
      );
  });
  it("validates read scopes and rejects blank labels, write scopes, duplicates and out-of-range expirations", async () => {
    for (const input of [
      { name: "  ", scopes: ["catalog.read"] },
      { name: "Key", scopes: ["sales.write"] },
      { name: "Key", scopes: ["catalog.read", "catalog.read"] },
      { name: "Key", scopes: [] },
      { name: "Key", scopes: ["catalog.read"], expiresInDays: 366 },
    ])
      assert.ok(
        (
          await validate(plainToInstance(CreateApiKeyDto, input), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      );
  });
});
