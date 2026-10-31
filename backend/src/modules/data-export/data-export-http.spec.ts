import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PrismaService } from "@/database/prisma/prisma.service";
import { DataExportController } from "./data-export.controller";
import { DataExportService } from "./data-export.service";

describe("Business export HTTP boundary", () => {
  let app: INestApplication;
  let url: string;
  const reads: unknown[] = [];
  before(async () => {
    const auth = {
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        if (!req.headers["x-test-role"]) throw new UnauthorizedException();
        req.user = {
          sub: "owner",
          roles: [req.headers["x-test-role"]],
          companyId: "company-a",
          companyStatus: "ACTIVE",
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [DataExportController],
      providers: [
        DataExportService,
        {
          provide: PrismaService,
          useValue: {
            membership: {
              findUnique: async () => ({
                role: "COMPANY_ADMIN",
                isActive: true,
              }),
            },
            product: {
              findMany: async (args: unknown) => {
                reads.push(args);
                return [];
              },
            },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(auth)
      .compile();
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
  const headers = { "x-test-role": "COMPANY_ADMIN" };
  it("rejects guests, cashiers, managers and platform actors before any operational query", async () => {
    assert.equal((await fetch(`${url}/data-export/manifest`)).status, 401);
    for (const role of ["CASHIER", "MANAGER", "SUPER_ADMIN", "SUPPORT_ADMIN"])
      assert.equal(
        (
          await fetch(`${url}/data-export/manifest`, {
            headers: { "x-test-role": role },
          })
        ).status,
        403,
      );
    assert.equal(reads.length, 0);
  });
  it("rejects tenant spoofing, oversized/hostile cursors and missing creation cutoffs", async () => {
    for (const query of [
      "",
      `startedAt=${new Date().toISOString()}&companyId=company-b`,
      `startedAt=${new Date().toISOString()}&after=%27%3BDELETE`,
      `startedAt=${new Date().toISOString()}&after=${"a".repeat(257)}`,
    ])
      assert.equal(
        (await fetch(`${url}/data-export/products?${query}`, { headers }))
          .status,
        400,
      );
    assert.equal(reads.length, 0);
  });
  it("returns a no-store tenant page for a valid company administrator", async () => {
    const response = await fetch(
      `${url}/data-export/products?startedAt=${new Date().toISOString()}`,
      { headers },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      collection: "products",
      rows: [],
      nextCursor: null,
    });
    assert.equal(reads.length, 1);
  });
});
