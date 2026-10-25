import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { Prisma } from "@prisma/client";
import { DistributorsService } from "./distributors.service";

function buildService(options: {
  distributor: unknown;
  products: unknown[];
  stock?: unknown[];
  tx?: Record<string, unknown>;
  kardex?: Record<string, unknown>;
  batches?: Record<string, unknown>;
}) {
  const prisma = {
    distributor: { findFirst: async () => options.distributor },
    product: { findMany: async () => options.products },
    distributorStock: {
      findMany: async (args: any) => {
        assert.equal(args.where.distributorId, "d1");
        assert.equal(args.where.quantity.gt, 0);
        return options.stock ?? [];
      },
    },
    $transaction: async (cb: (tx: unknown) => unknown) =>
      cb({
        distributor: { findFirst: async () => ({ stockReconciled: true }) },
        distributorStock: {
          upsert: async () => ({}),
          updateMany: async () => ({ count: 1 }),
        },
        ...(options.tx ?? {}),
      }),
  } as any;

  const kardexService = options.kardex ?? {};
  const lowStockService = { notifyIfLowStock: async () => true };
  const productBatchesService = options.batches ?? {};
  const auditService = { log: async () => undefined } as any;

  return new DistributorsService(
    prisma,
    kardexService as any,
    lowStockService as any,
    productBatchesService as any,
    auditService,
  );
}

describe("DistributorsService.findStock", () => {
  it("returns only positive stock for the scoped distributor", async () => {
    const stock = [
      { productId: "p1", quantity: new Prisma.Decimal(2.5) },
      { productId: "p2", quantity: new Prisma.Decimal(1) },
    ];
    const svc = buildService({
      distributor: {
        id: "d1",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [],
      },
      products: [],
      stock,
    });

    const result = await svc.findStock("com-a", "d1");

    assert.deepEqual(result, stock);
  });
});

describe("DistributorsService.transfer", () => {
  it("rejects products from another tenant (lookup is scoped)", async () => {
    const svc = buildService({
      distributor: {
        id: "d1",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [],
      },
      products: [],
    });

    await assert.rejects(
      () =>
        svc.transfer("com-a", "d1", {
          items: [{ productId: "p-other", quantity: 1 }],
        }),
      /no encontrado/i,
    );
  });

  it("rejects when company stock is insufficient", async () => {
    const svc = buildService({
      distributor: {
        id: "d1",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [],
      },
      products: [
        { id: "p1", name: "Producto A", stockQuantity: new Prisma.Decimal(1) },
      ],
    });

    await assert.rejects(
      () =>
        svc.transfer("com-a", "d1", {
          items: [{ productId: "p1", quantity: 5 }],
        }),
      /stock insuficiente/i,
    );
  });

  it("decrements stock, records TRANSFER movement, kardex and balance", async () => {
    let kardexCalls = 0;
    let batchCalls = 0;
    const upsertCalls: Array<Record<string, unknown>> = [];
    const tx = {
      product: { updateMany: async () => ({ count: 1 }) },
      inventoryMovement: {
        create: async (args: any) => {
          assert.equal(args.data.type, "TRANSFER");
          assert.equal(args.data.quantity, -2);
          return { id: "m1" };
        },
      },
      distributorBalance: {
        upsert: async (args: any) => {
          upsertCalls.push(args);
          return { distributorId: "d1", balanceQuantity: 2 };
        },
      },
    };

    const svc = buildService({
      distributor: {
        id: "d1",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [],
      },
      products: [
        {
          id: "p1",
          name: "Producto A",
          stockQuantity: new Prisma.Decimal(10),
          salePrice: new Prisma.Decimal(50),
        },
      ],
      tx,
      kardex: {
        recordOutMovement: async () => {
          kardexCalls += 1;
        },
      },
      batches: {
        reserveFromBatch: async () => {
          batchCalls += 1;
        },
      },
    });

    const result: any = await svc.transfer("com-a", "d1", {
      items: [{ productId: "p1", quantity: 2 }],
    });

    assert.equal(result.transferredQuantity, 2);
    assert.equal(result.debtAdded, 100);
    assert.equal(kardexCalls, 1);
    assert.equal(batchCalls, 1);
    assert.equal(upsertCalls.length, 1);
    assert.equal(upsertCalls[0].create.balanceQuantity, 2);
    assert.equal(Number(upsertCalls[0].create.debtAmount), 100);
    assert.equal(upsertCalls[0].update.debtAmount.increment, 100);
  });
});

describe("DistributorsService.registerSale", () => {
  it("rejects when the distributor balance is insufficient", async () => {
    const svc = buildService({
      distributor: {
        id: "d1",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [{ balanceQuantity: 1 }],
      },
      products: [{ id: "p1", name: "Producto A", salePrice: 50 }],
    });

    await assert.rejects(
      () =>
        svc.registerSale(
          "com-a",
          "d1",
          {
            items: [{ productId: "p1", quantity: 3 }],
            paymentMethod: "CASH",
          },
          { userId: "manager", roles: ["MANAGER"] },
        ),
      /mercaderia suficiente/i,
    );
  });

  it("creates a DISTRIBUTOR sale and moves stock without changing debt", async () => {
    const saleCreateArgs: Array<Record<string, any>> = [];
    const balanceUpdates: Array<Record<string, any>> = [];
    let saleNumber = "";
    const tx = {
      sale: {
        create: async (args: any) => {
          saleCreateArgs.push(args);
          saleNumber = args.data.saleNumber;
          return {
            id: "s1",
            saleNumber: args.data.saleNumber,
            totalAmount: new Prisma.Decimal(100),
            items: [],
          };
        },
      },
      distributorBalance: {
        findUnique: async () => ({ debtAmount: new Prisma.Decimal(0) }),
        updateMany: async (args: any) => {
          balanceUpdates.push(args);
          return { count: 1 };
        },
      },
    };

    const svc = buildService({
      distributor: {
        id: "d1",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [{ balanceQuantity: 10 }],
      },
      products: [{ id: "p1", name: "Producto A", salePrice: 50 }],
      tx,
    });

    const sale: any = await svc.registerSale(
      "com-a",
      "d1",
      {
        items: [{ productId: "p1", quantity: 2 }],
        paymentMethod: "CASH",
      },
      { userId: "manager", roles: ["MANAGER"] },
    );

    assert.equal(sale.id, "s1");
    assert.equal(saleCreateArgs.length, 1);
    assert.equal(saleCreateArgs[0].data.channel, "DISTRIBUTOR");
    assert.equal(saleCreateArgs[0].data.distributorId, "d1");
    assert.equal(Number(saleCreateArgs[0].data.totalAmount), 100);
    assert.equal(saleNumber.startsWith("SALE-"), true);
    assert.equal(balanceUpdates.length, 1);
    assert.equal(Number(balanceUpdates[0].data.soldQuantity.increment), 2);
    assert.equal(balanceUpdates[0].data.debtAmount, undefined);
  });
});

describe("DistributorsService.settle", () => {
  it("rejects a settlement larger than the pending debt", async () => {
    const tx = {
      distributorBalance: {
        findUnique: async () => ({ debtAmount: new Prisma.Decimal(10) }),
        update: async () => ({ distributorId: "d1" }),
      },
      financeRecord: { create: async () => ({ id: "f1" }) },
    };
    const svc = buildService({
      distributor: {
        id: "d1",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [{ debtAmount: new Prisma.Decimal(10) }],
      },
      products: [],
      tx,
    });

    await assert.rejects(
      () => svc.settle("com-a", "d1", { amount: 50 }),
      /excede la deuda/i,
    );
  });

  it("reduces debt and registers an ENTRY finance record", async () => {
    let debt = new Prisma.Decimal(100);
    const financeCreates: Array<Record<string, any>> = [];
    const tx = {
      distributorBalance: {
        findUnique: async () => ({ debtAmount: debt }),
        updateMany: async () => {
          debt = debt.minus(60);
          return { count: 1 };
        },
      },
      financeRecord: {
        create: async (args: any) => {
          financeCreates.push(args);
          return { id: "f1" };
        },
      },
    };
    const svc = buildService({
      distributor: {
        id: "d1",
        code: "D-001",
        name: "Distri Uno",
        companyId: "com-a",
        status: "ACTIVE",
        balances: [{ debtAmount: new Prisma.Decimal(100) }],
      },
      products: [],
      tx,
    });

    const balance: any = await svc.settle("com-a", "d1", { amount: 60 }, "u1");

    assert.equal(Number(balance.debtAmount), 40);
    assert.equal(financeCreates.length, 1);
    assert.equal(financeCreates[0].data.direction, "ENTRY");
    assert.equal(financeCreates[0].data.category, "SALE");
    assert.equal(Number(financeCreates[0].data.amount), 60);
    assert.equal(financeCreates[0].data.createdById, "u1");
    assert.equal(financeCreates[0].data.companyId, "com-a");
  });
});
