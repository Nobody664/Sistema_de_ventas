import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { StockExitsService } from "./stock-exits.service";

function buildService(options: {
  distributor: unknown;
  transfer?: (companyId: string, id: string, dto: unknown) => unknown;
}) {
  const prisma = {
    distributor: { findFirst: async () => options.distributor },
  } as any;

  const distributorsService = {
    transfer:
      options.transfer ??
      (async () => ({ distributorId: "d1", transferredQuantity: 0 })),
  } as any;

  const auditService = { log: async () => undefined } as any;

  return new StockExitsService(prisma, distributorsService, auditService);
}

describe("StockExitsService.create", () => {
  it("rejects when the distributor does not exist in the tenant", async () => {
    const svc = buildService({ distributor: null });

    await assert.rejects(
      () =>
        svc.create("com-a", "u1", {
          distributorId: "d-other",
          items: [{ productId: "p1", quantity: 1 }],
        }),
      /no encontrado/i,
    );
  });

  it("delegates to DistributorsService.transfer and audits the exit", async () => {
    const transferCalls: Array<Record<string, unknown>> = [];
    let audited = false;

    const svc = new StockExitsService(
      {
        distributor: {
          findFirst: async () => ({ id: "d1", name: "Dist" }),
        },
      } as any,
      {
        transfer: async (companyId: string, id: string, dto: unknown) => {
          transferCalls.push({ companyId, id, dto });
          return { distributorId: id, transferredQuantity: 3 };
        },
      } as any,
      {
        log: async () => {
          audited = true;
        },
      } as any,
    );

    const result: any = await svc.create("com-a", "u1", {
      distributorId: "d1",
      items: [{ productId: "p1", quantity: 3 }],
      notes: "Salida",
    });

    assert.equal(result.transferredQuantity, 3);
    assert.equal(transferCalls.length, 1);
    assert.equal(transferCalls[0].companyId, "com-a");
    assert.equal(transferCalls[0].id, "d1");
    assert.equal(audited, true);
  });
});
