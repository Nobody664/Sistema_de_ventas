import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { Prisma } from "@prisma/client";
import { SalesService } from "./sales.service";

function makeSaleService(
  lookups: {
    findMany?: (args: Prisma.SaleFindManyArgs) => Promise<unknown[]>;
    findFirst?: (args: Prisma.SaleFindFirstArgs) => Promise<unknown>;
    onCreate?: (data: { sellerId?: string | null }) => void;
  } = {},
) {
  const saleCreated = {
    id: "s1",
    saleNumber: "SALE-1",
    totalAmount: 100,
    paymentMethod: "CASH",
    customerId: null,
    employeeId: null,
    items: [],
  };
  const tx = {
    outboxEvent: { upsert: async () => ({}) },
    sale: {
      create: async ({ data }: { data: { sellerId?: string | null } }) => {
        lookups.onCreate?.(data);
        return saleCreated;
      },
    },
    product: { updateMany: async () => ({ count: 1 }) },
    inventoryMovement: { create: async () => ({ id: "m1" }) },
  } as any;
  const prisma = {
    sale: { findMany: lookups.findMany, findFirst: lookups.findFirst },
    product: {
      findMany: async () => [
        {
          id: "p1",
          stockQuantity: new Prisma.Decimal(10),
          name: "Producto A",
          salePrice: new Prisma.Decimal(50),
        },
      ],
    },
    $transaction: async (cb: any) => cb(tx),
  } as any;
  const notificationsService = {} as any;
  const lowStockService = { notifyIfLowStock: async () => true } as any;
  const kardexService = { recordOutMovement: async () => undefined } as any;
  const productBatchesService = {
    reserveFromBatch: async () => undefined,
  } as any;
  const auditService = { log: async () => undefined } as any;

  const svc = new SalesService(
    prisma,
    notificationsService,
    lowStockService,
    kardexService,
    productBatchesService,
    auditService,
  );
  return svc;
}

describe("SalesService.createSale", () => {
  it("records the authenticated seller on a new sale", async () => {
    let sellerId: string | null | undefined;
    const svc = makeSaleService({
      onCreate: (data) => {
        sellerId = data.sellerId;
      },
    });
    await svc.createSale(
      "com-a",
      { items: [{ productId: "p1", quantity: 2 }], paymentMethod: "CASH" },
      { userId: "cashier", roles: ["CASHIER"] },
    );
    assert.equal(sellerId, "cashier");
  });
  it("creates a sale without throwing the TDZ reference error", async () => {
    const svc = makeSaleService();
    const sale = await svc.createSale(
      "com-a",
      {
        items: [{ productId: "p1", quantity: 2 }],
        paymentMethod: "CASH",
      } as any,
      { userId: "cashier", roles: ["CASHIER"] },
    );

    assert.equal(sale.id, "s1");
    assert.equal(sale.saleNumber, "SALE-1");
  });

  it("rejects items from another tenant (product lookup is scoped)", async () => {
    const prisma = { product: { findMany: async () => [] } } as any;
    const svc = new SalesService(
      prisma,
      {} as any,
      { notifyIfLowStock: async () => true } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      () =>
        svc.createSale(
          "com-a",
          {
            items: [{ productId: "p-other", quantity: 1 }],
            paymentMethod: "CASH",
          } as any,
          { userId: "cashier", roles: ["CASHIER"] },
        ),
      /not found/i,
    );
  });
});

describe("SalesService seller visibility", () => {
  it("scopes a cashier to their own company and seller while preserving pagination", async () => {
    let query: Prisma.SaleFindManyArgs | undefined;
    const svc = makeSaleService({
      findMany: async (args) => {
        query = args;
        return [];
      },
    });
    await svc.findRecentSales(
      "com-a",
      { page: 2, limit: 10 },
      { userId: "cashier", roles: ["USER", "CASHIER"] },
    );
    assert.deepEqual(query?.where, { companyId: "com-a", sellerId: "cashier" });
    assert.equal(query?.skip, 10);
    assert.deepEqual(query?.select?.seller, {
      select: { id: true, fullName: true },
    });
  });

  it("recognizes admin permissions regardless of role ordering without removing tenant scope", async () => {
    let query: Prisma.SaleFindManyArgs | undefined;
    const svc = makeSaleService({
      findMany: async (args) => {
        query = args;
        return [];
      },
    });
    await svc.findRecentSales(
      "com-a",
      {},
      { userId: "admin", roles: ["USER", "COMPANY_ADMIN"] },
    );
    assert.deepEqual(query?.where, { companyId: "com-a" });
  });

  it("hides another seller's sale when the cashier guesses its ID", async () => {
    let query: Prisma.SaleFindFirstArgs | undefined;
    const svc = makeSaleService({
      findFirst: async (args) => {
        query = args;
        return null;
      },
    });
    await assert.rejects(
      svc.findById("com-a", "another-sale", {
        userId: "cashier",
        roles: ["CASHIER"],
      }),
      /Venta no encontrada/,
    );
    assert.deepEqual(query?.where, {
      id: "another-sale",
      companyId: "com-a",
      sellerId: "cashier",
    });
  });
});
