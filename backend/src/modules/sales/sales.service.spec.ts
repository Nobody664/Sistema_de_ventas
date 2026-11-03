import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { Prisma } from "@prisma/client";
import { SalesService } from "./sales.service";

function makeSaleService(
  lookups: {
    findMany?: (args: Prisma.SaleFindManyArgs) => Promise<unknown[]>;
    findFirst?: (args: Prisma.SaleFindFirstArgs) => Promise<unknown>;
    onCreate?: (data: {
      sellerId?: string | null;
      customerId?: string | null;
      customerName?: string | null;
      customerDocumentType?: string | null;
      customerDocumentValue?: string | null;
    }) => void;
    customerFindFirst?: (
      args: Prisma.CustomerFindFirstArgs,
    ) => Promise<unknown>;
    customerCreate?: (
      args: Prisma.CustomerCreateArgs,
    ) => Promise<{ id: string }>;
    customerLimit?: { current: number; limit: number };
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
      create: async ({
        data,
      }: {
        data: {
          sellerId?: string | null;
          customerId?: string | null;
          customerName?: string | null;
          customerDocumentType?: string | null;
          customerDocumentValue?: string | null;
        };
      }) => {
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
    customer: {
      findFirst: lookups.customerFindFirst,
      create: lookups.customerCreate,
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
  const limitService = {
    checkLimit: async () => lookups.customerLimit ?? { current: 0, limit: 10 },
  } as any;

  const svc = new SalesService(
    prisma,
    notificationsService,
    lowStockService,
    kardexService,
    productBatchesService,
    auditService,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    limitService,
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

  it("creates a customer from inline DNI data and stores its snapshot", async () => {
    let customerData: any;
    let saleData: any;
    const svc = makeSaleService({
      onCreate: (data) => {
        saleData = data;
      },
      customerFindFirst: async () => null,
      customerCreate: async ({ data }) => {
        customerData = data;
        return { id: "c-dni" };
      },
    });

    await svc.createSale(
      "com-a",
      {
        customer: {
          firstName: " Ana ",
          lastName: " Perez ",
          documentType: "dni",
          documentValue: " 12345678 ",
        },
        items: [{ productId: "p1", quantity: 1 }],
        paymentMethod: "CASH",
      },
      { userId: "cashier", roles: ["CASHIER"] },
    );

    assert.equal(customerData.firstName, "Ana");
    assert.equal(customerData.documentType, "DNI");
    assert.equal(customerData.documentValue, "12345678");
    assert.equal(saleData.customerId, "c-dni");
    assert.equal(saleData.customerName, "Ana Perez");
    assert.equal(saleData.customerDocumentType, "DNI");
    assert.equal(saleData.customerDocumentValue, "12345678");
  });

  it("reuses an existing customer with the same document", async () => {
    let customerCreated = false;
    let saleData: any;
    const svc = makeSaleService({
      onCreate: (data) => {
        saleData = data;
      },
      customerFindFirst: async () => ({ id: "c-existing" }),
      customerCreate: async () => {
        customerCreated = true;
        return { id: "c-new" };
      },
    });

    await svc.createSale(
      "com-a",
      {
        customer: {
          firstName: "Ana",
          documentType: "DNI",
          documentValue: "12345678",
        },
        items: [{ productId: "p1", quantity: 1 }],
        paymentMethod: "CASH",
      },
      { userId: "cashier", roles: ["CASHIER"] },
    );

    assert.equal(customerCreated, false);
    assert.equal(saleData.customerId, "c-existing");
  });

  it("keeps the customer snapshot when the customer limit is reached", async () => {
    let customerCreated = false;
    let saleData: any;
    const svc = makeSaleService({
      onCreate: (data) => {
        saleData = data;
      },
      customerFindFirst: async () => null,
      customerCreate: async () => {
        customerCreated = true;
        return { id: "c-new" };
      },
      customerLimit: { current: 5, limit: 5 },
    });

    await svc.createSale(
      "com-a",
      {
        customer: {
          firstName: "Ana",
          lastName: "Perez",
          documentType: "DNI",
          documentValue: "12345678",
        },
        items: [{ productId: "p1", quantity: 1 }],
        paymentMethod: "CASH",
      },
      { userId: "cashier", roles: ["CASHIER"] },
    );

    assert.equal(customerCreated, false);
    assert.equal(saleData.customerId, undefined);
    assert.equal(saleData.customerName, "Ana Perez");
    assert.equal(saleData.customerDocumentValue, "12345678");
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
