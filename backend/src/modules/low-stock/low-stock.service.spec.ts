import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { LowStockService } from "./low-stock.service";

type Opts = {
  members?: { userId: string }[];
  pending?: { userId: string }[];
  products?: any[];
};

function makeService(opts: Opts = {}) {
  const createCalls: any[] = [];
  const membershipFindMany: any[] = [];
  const notificationFindMany: any[] = [];

  const prisma = {
    membership: {
      findMany: async (args: any) => {
        membershipFindMany.push(args);
        return opts.members ?? [];
      },
    },
    notification: {
      findMany: async (args: any) => {
        notificationFindMany.push(args);
        return opts.pending ?? [];
      },
    },
    product: {
      fields: { minStock: "minStock", stockQuantity: "stockQuantity" },
      findMany: async () => opts.products ?? [],
    },
  } as any;

  const notificationsService = {
    create: async (input: any) => {
      createCalls.push(input);
      return input;
    },
  } as any;

  return {
    svc: new LowStockService(prisma, notificationsService),
    createCalls,
    membershipFindMany,
    notificationFindMany,
  };
}

describe("LowStockService.notifyIfLowStock", () => {
  it("notifies COMPANY_ADMIN and MANAGER members when stock drops below the minimum", async () => {
    const { svc, createCalls, membershipFindMany } = makeService({
      members: [{ userId: "admin1" }, { userId: "manager1" }],
    });

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: "Arroz",
      currentStock: 3,
      minStock: 5,
      baseUnit: "UNIT",
      previousStock: 10,
    });

    assert.equal(sent, true);
    assert.equal(createCalls.length, 2);
    assert.deepEqual(createCalls.map((call) => call.userId).sort(), [
      "admin1",
      "manager1",
    ]);
    assert.equal(createCalls[0].type, "LOW_STOCK");
    assert.equal(createCalls[0].companyId, "com-a");
    assert.match(createCalls[0].title, /stock bajo/i);
    assert.match(createCalls[0].message, /Arroz/);
    assert.equal(createCalls[0].data.productId, "p1");
    assert.equal(createCalls[0].actionUrl, "/products/p1");
    assert.deepEqual(membershipFindMany[0].where.role.in.slice().sort(), [
      "COMPANY_ADMIN",
      "MANAGER",
    ]);
  });

  it("deduplicates recipients that already have a pending unread alert", async () => {
    const { svc, createCalls } = makeService({
      members: [{ userId: "admin1" }, { userId: "manager1" }],
      pending: [{ userId: "admin1" }],
    });

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: "Arroz",
      currentStock: 3,
      minStock: 5,
      previousStock: 10,
    });

    assert.equal(sent, true);
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].userId, "manager1");
  });

  it("returns false and sends nothing when stock is above the minimum", async () => {
    const { svc, createCalls, notificationFindMany } = makeService({
      members: [{ userId: "admin1" }],
    });

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: "Arroz",
      currentStock: 20,
      minStock: 5,
    });

    assert.equal(sent, false);
    assert.equal(createCalls.length, 0);
    assert.equal(notificationFindMany.length, 0);
  });

  it("does not repeat while the product was already below the previous minimum", async () => {
    const { svc, createCalls } = makeService({
      members: [{ userId: "admin1" }],
    });

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: "Arroz",
      currentStock: 4,
      minStock: 5,
      previousStock: 4,
      previousMinStock: 5,
    });

    assert.equal(sent, false);
    assert.equal(createCalls.length, 0);
  });

  it("notifies when the minimum is raised above the current stock", async () => {
    const { svc, createCalls } = makeService({
      members: [{ userId: "admin1" }],
    });

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: "Arroz",
      currentStock: 3,
      minStock: 5,
      previousStock: 3,
      previousMinStock: 1,
    });

    assert.equal(sent, true);
    assert.equal(createCalls.length, 1);
  });

  it("honours force to alert an already-low product (used by the sweep)", async () => {
    const { svc, createCalls } = makeService({
      members: [{ userId: "admin1" }],
    });

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: "Arroz",
      currentStock: 2,
      minStock: 5,
      previousStock: 2,
      previousMinStock: 5,
      force: true,
    });

    assert.equal(sent, true);
    assert.equal(createCalls.length, 1);
  });

  it("returns false when the company has no admin or manager members", async () => {
    const { svc, createCalls } = makeService({ members: [] });

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: "Arroz",
      currentStock: 1,
      minStock: 5,
    });

    assert.equal(sent, false);
    assert.equal(createCalls.length, 0);
  });

  it("is null-safe for stock, threshold, name and unit values", async () => {
    const { svc, createCalls } = makeService({
      members: [{ userId: "admin1" }],
    });

    const invalid = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: null,
      currentStock: null,
      minStock: 5,
    });
    assert.equal(invalid, false);

    const sent = await svc.notifyIfLowStock({
      companyId: "com-a",
      productId: "p1",
      productName: null,
      currentStock: 1,
      minStock: 5,
      baseUnit: null,
    });
    assert.equal(sent, true);
    assert.match(createCalls[0].message, /Producto/);
    assert.match(createCalls[0].message, /unidades/);
  });
});

describe("LowStockService.scanLowStock", () => {
  it("alerts for every active product at or below its minimum", async () => {
    const { svc, createCalls } = makeService({
      members: [{ userId: "admin1" }],
      products: [
        {
          id: "p1",
          companyId: "com-a",
          name: "Arroz",
          stockQuantity: 2,
          minStock: 5,
          baseUnit: "KG",
        },
        {
          id: "p2",
          companyId: "com-a",
          name: "Leche",
          stockQuantity: 0,
          minStock: 3,
          baseUnit: "LT",
        },
      ],
    });

    const notified = await svc.scanLowStock();

    assert.equal(notified, 2);
    assert.equal(createCalls.length, 2);
    assert.match(createCalls[0].message, /kg/);
    assert.match(createCalls[1].message, /litros/);
  });

  it("swallows errors and returns zero when the scan fails", async () => {
    const prisma = {
      product: {
        fields: { minStock: "minStock", stockQuantity: "stockQuantity" },
        findMany: async () => {
          throw new Error("db down");
        },
      },
    } as any;
    const svc = new LowStockService(prisma, {
      create: async () => undefined,
    } as any);

    const notified = await svc.scanLowStock();

    assert.equal(notified, 0);
  });
});
