import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { ApiQuotaService } from "./api-quota.service";
import { PrismaService } from "@/database/prisma/prisma.service";
import { DniService } from "@/modules/dni/dni.service";

describe("Atomic API quota and external-attempt policy", () => {
  it("does not exceed the shared quota under concurrent claims", async () => {
    let count = 0;
    let queue = Promise.resolve();
    const tx = {
      apiUsage: {
        upsert: async () => ({ id: "usage", count }),
        updateMany: async ({
          where,
          data,
        }: {
          where: { count: { lte: number } };
          data: { count: { increment: number } };
        }) => {
          if (count > where.count.lte) return { count: 0 };
          count += data.count.increment;
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: <T>(work: (client: typeof tx) => Promise<T>) => {
        const result = queue.then(() => work(tx));
        queue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    } as unknown as PrismaService;
    const service = new ApiQuotaService(prisma, {
      getCapabilities: async () => ({
        apiEnabled: true,
        apiQuota: 3,
        planCode: "PRO",
      }),
    } as never);
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => service.consume("company")),
    );
    assert.equal(count, 3);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      3,
    );
    for (const result of results)
      if (result.status === "rejected")
        assert.equal(result.reason.getStatus(), 429);
  });
  it("rejects non-positive and fractional claims before accessing the database", async () => {
    const service = new ApiQuotaService({} as PrismaService, {} as never);
    for (const amount of [0, -1, 1.5, NaN, Infinity])
      await assert.rejects(service.consume("company", amount), { status: 400 });
  });
  it("serves a valid cache hit without consuming another attempt", async () => {
    let consumed = 0;
    const service = new DniService(
      { get: () => undefined } as unknown as ConfigService,
      { get: async () => ({ dni: "12345678", nombres: "Persona" }) } as never,
      {
        consume: async () => {
          consumed++;
        },
      } as never,
    );
    await service.findByDni("12345678", "company");
    assert.equal(consumed, 0);
    await assert.rejects(service.findByDni("bad", "company"));
    assert.equal(consumed, 0);
  });
  it("charges one external attempt even when the provider fails", async (context) => {
    let consumed = 0;
    context.mock.method(
      globalThis,
      "fetch",
      async () => new Response("unavailable", { status: 503 }),
    );
    const service = new DniService(
      { get: () => undefined } as unknown as ConfigService,
      { get: async () => null } as never,
      {
        consume: async () => {
          consumed++;
        },
      } as never,
    );
    await assert.rejects(service.findByDni("12345678", "company"));
    assert.equal(consumed, 1);
  });
});
