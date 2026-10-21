import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";

function makeService(
  prisma: any,
  stockEntries: any = { create: async () => ({ id: "se1" }) },
) {
  const audits: any[] = [];
  const audit = {
    log: async (input: any) => {
      audits.push(input);
    },
  } as any;
  return {
    svc: new SuppliersService(prisma, audit, stockEntries),
    audits,
  };
}

describe("SuppliersService.getAutoOrdersPreview", () => {
  it("groups low-stock products by preferred supplier with suggested quantities", async () => {
    const prisma = {
      product: {
        findMany: async () => [
          {
            id: "p1",
            name: "A",
            sku: "A1",
            baseUnit: "UNIT",
            stockQuantity: 2,
            minStock: 10,
            costPrice: 5,
          },
          {
            id: "p2",
            name: "B",
            sku: "B1",
            baseUnit: "UNIT",
            stockQuantity: 8,
            minStock: 10,
            costPrice: 3,
          },
          {
            id: "p3",
            name: "C",
            sku: "C1",
            baseUnit: "UNIT",
            stockQuantity: 100,
            minStock: 10,
            costPrice: 1,
          },
        ],
      },
      supplierProduct: {
        findMany: async () => [
          {
            productId: "p1",
            supplierId: "s1",
            isPreferred: true,
            minOrderQuantity: 5,
            supplier: { id: "s1", name: "Prov 1", code: "P1", isActive: true },
          },
          {
            productId: "p1",
            supplierId: "s2",
            isPreferred: false,
            minOrderQuantity: 1,
            supplier: { id: "s2", name: "Prov 2", code: "P2", isActive: true },
          },
          {
            productId: "p2",
            supplierId: "s1",
            isPreferred: false,
            minOrderQuantity: 20,
            supplier: { id: "s1", name: "Prov 1", code: "P1", isActive: true },
          },
        ],
      },
    };
    const { svc } = makeService(prisma);

    const preview = await svc.getAutoOrdersPreview("c1");

    assert.equal(preview.groups.length, 1);
    const group = preview.groups[0];
    assert.equal(group.supplier.id, "s1");
    assert.equal(group.items.length, 2);

    const itemA = group.items.find((item) => item.productId === "p1")!;
    assert.equal(itemA.missingUnits, 8);
    assert.equal(itemA.suggestedQuantity, 8);

    const itemB = group.items.find((item) => item.productId === "p2")!;
    assert.equal(itemB.suggestedQuantity, 20);
    assert.equal(preview.unassigned.length, 0);
  });

  it("reports products without any preferred supplier as unassigned", async () => {
    const prisma = {
      product: {
        findMany: async () => [
          {
            id: "p1",
            name: "A",
            sku: "A1",
            baseUnit: "UNIT",
            stockQuantity: 0,
            minStock: 5,
            costPrice: 2,
          },
        ],
      },
      supplierProduct: { findMany: async () => [] },
    };
    const { svc } = makeService(prisma);

    const preview = await svc.getAutoOrdersPreview("c1");

    assert.equal(preview.groups.length, 0);
    assert.equal(preview.unassigned.length, 1);
    assert.equal(preview.unassigned[0].productId, "p1");
  });
});

describe("SuppliersService.generateAutoOrders", () => {
  it("throws when there is nothing to order", async () => {
    const prisma = {
      product: { findMany: async () => [] },
      supplierProduct: { findMany: async () => [] },
    };
    const { svc } = makeService(prisma);

    await assert.rejects(
      () => svc.generateAutoOrders("c1", "u1"),
      BadRequestException,
    );
  });
});

describe("SuppliersService.create", () => {
  it("rejects duplicated supplier names", async () => {
    const prisma = {
      supplier: { findFirst: async () => ({ id: "s1" }) },
    };
    const { svc } = makeService(prisma);

    await assert.rejects(
      () => svc.create("c1", "u1", { name: "Prov" } as any),
      /Ya existe/,
    );
  });
});

describe("SuppliersService.receiveOrder", () => {
  it("creates a stock entry and confirms the order", async () => {
    let stockEntryInput: any;
    let orderUpdate: any;
    let currentStatus = "SENT";
    const stockEntries = {
      create: async (_companyId: string, input: any) => {
        stockEntryInput = input;
        return { id: "se1" };
      },
    };
    const prisma = {
      supplierOrder: {
        findFirst: async () => ({
          id: "o1",
          status: currentStatus,
          supplierId: "s1",
          reference: "REF",
          totalEstimated: null,
          items: [],
        }),
      },
      supplierOrderItem: { updateMany: async () => ({ count: 1 }) },
      supplierProduct: { updateMany: async () => ({ count: 1 }) },
      $transaction: async (fn: any) =>
        fn({
          supplierOrder: {
            update: async ({ data }: any) => {
              orderUpdate = data;
              currentStatus = data.status;
              return { id: "o1", ...data };
            },
          },
          supplierOrderItem: { updateMany: async () => ({ count: 1 }) },
          supplierProduct: { updateMany: async () => ({ count: 1 }) },
        }),
    };
    const { svc } = makeService(prisma, stockEntries);

    const result = await svc.receiveOrder("c1", "u1", "o1", {
      items: [{ productId: "p1", quantity: 5, unitCost: 4 }],
    } as any);

    assert.equal(stockEntryInput.items[0].productId, "p1");
    assert.equal(stockEntryInput.items[0].unitCost, 4);
    assert.equal(orderUpdate.status, "CONFIRMED");
    assert.equal(result.status, "CONFIRMED");
  });

  it("blocks receiving a cancelled order", async () => {
    const prisma = {
      supplierOrder: {
        findFirst: async () => ({
          id: "o1",
          status: "CANCELLED",
          supplierId: "s1",
          reference: null,
        }),
      },
    };
    const { svc } = makeService(prisma);

    await assert.rejects(
      () =>
        svc.receiveOrder("c1", "u1", "o1", {
          items: [{ productId: "p1", quantity: 1, unitCost: 1 }],
        } as any),
      BadRequestException,
    );
  });
});

describe("SuppliersService.findOne", () => {
  it("throws when the supplier does not belong to the company", async () => {
    const prisma = { supplier: { findFirst: async () => null } };
    const { svc } = makeService(prisma);

    await assert.rejects(() => svc.findOne("c1", "s1"), NotFoundException);
  });
});
