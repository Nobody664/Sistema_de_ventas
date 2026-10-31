import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PrismaService } from "@/database/prisma/prisma.service";
import { ApiQuotaService } from "@/modules/plan-capabilities/api-quota.service";
import { ApiKeysService, hashApiKey } from "./api-keys.service";
import { IntegrationOwnerService } from "./integration-owner.service";
import { ApiKeyGuard } from "./api-key.guard";
import { ReadApiController } from "./read-api.controller";
import { ReadApiService } from "./read-api.service";

describe("Read-only external API HTTP", () => {
  let app: INestApplication;
  let url: string;
  const id = randomUUID();
  const key = `vsk_${id}.${"a".repeat(43)}`;
  const queries: Array<{
    where: Record<string, unknown>;
    select: Record<string, boolean>;
    take: number;
  }> = [];
  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReadApiController],
      providers: [
        ApiKeysService,
        ReadApiService,
        ApiKeyGuard,
        { provide: IntegrationOwnerService, useValue: {} },
        { provide: ApiQuotaService, useValue: { consume: async () => {} } },
        {
          provide: PrismaService,
          useValue: {
            companyApiKey: {
              findUnique: async () => ({
                id,
                companyId: "company-a",
                keyHash: hashApiKey(key),
                revokedAt: null,
                expiresAt: new Date(Date.now() + 60000),
                scopes: ["catalog.read"],
                company: { status: "ACTIVE" },
                membership: {
                  companyId: "company-a",
                  isActive: true,
                  role: "COMPANY_ADMIN",
                  user: { isActive: true },
                },
              }),
              updateMany: async () => ({ count: 1 }),
            },
            product: {
              findMany: async (query: (typeof queries)[number]) => {
                queries.push(query);
                return [{ id: "product-a", salePrice: "1.2345" }];
              },
            },
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });
  after(async () => {
    await app?.close();
  });
  it("requires an API key even when a browser session cookie is present", async () => {
    assert.equal(
      (
        await fetch(`${url}/integrations/v1/catalog`, {
          headers: { Cookie: "access_token=session" },
        })
      ).status,
      401,
    );
    assert.equal(queries.length, 0);
  });
  it("uses only the key's tenant and approved read projection", async () => {
    const response = await fetch(
      `${url}/integrations/v1/catalog?after=product-previous`,
      { headers: { "X-API-Key": key } },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      version: 1,
      items: [{ id: "product-a", salePrice: "1.2345" }],
      nextCursor: null,
    });
    assert.deepEqual(queries[0].where, {
      companyId: "company-a",
      deletedAt: null,
      id: { gt: "product-previous" },
    });
    assert.equal(queries[0].select.costPrice, undefined);
    assert.equal(queries[0].take, 101);
  });
  it("rejects tenant overrides and missing read scopes, and exposes no write route", async () => {
    assert.equal(
      (
        await fetch(`${url}/integrations/v1/catalog?companyId=company-b`, {
          headers: { "X-API-Key": key },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${url}/integrations/v1/sales`, {
          headers: { "X-API-Key": key },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${url}/integrations/v1/catalog`, {
          method: "POST",
          headers: { "X-API-Key": key },
        })
      ).status,
      404,
    );
    assert.equal(queries.length, 1);
  });
});
