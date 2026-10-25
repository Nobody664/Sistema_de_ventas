import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("Readiness HTTP semantics", () => {
  let app: INestApplication;
  let url: string;
  let database = true;
  let redis = true;
  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: async () => {
              if (!database) throw new Error("database offline");
              return [{ value: 1 }];
            },
          },
        },
        {
          provide: CacheService,
          useValue: { ping: async () => (redis ? "PONG" : null) },
        },
        {
          provide: ConfigService,
          useValue: { get: () => "redis://test.invalid" },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });
  after(async () => {
    await app?.close();
  });
  it("returns 503 when PostgreSQL is unavailable but keeps liveness independent", async () => {
    database = false;
    const response = await fetch(`${url}/health/ready`);
    assert.equal(response.status, 503);
    assert.equal(
      ((await response.json()) as { status: string }).status,
      "unavailable",
    );
    assert.equal((await fetch(`${url}/health/live`)).status, 200);
    database = true;
  });
  it("tolerates optional Redis degradation with an explicit degraded body", async () => {
    redis = false;
    const response = await fetch(`${url}/health/ready`);
    assert.equal(response.status, 200);
    assert.equal(
      ((await response.json()) as { status: string }).status,
      "degraded",
    );
    redis = true;
  });
});
