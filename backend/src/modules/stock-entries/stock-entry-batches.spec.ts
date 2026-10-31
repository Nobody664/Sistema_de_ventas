import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { StockEntriesService } from "./stock-entries.service";

function fixture(failBatchAt?: number) {
  const state = {
    stock: 10,
    batches: [] as Record<string, unknown>[],
    items: [] as Record<string, unknown>[],
    movements: 0,
  };
  const tx = {
    product: {
      findMany: async () => [
        {
          id: "p1",
          name: "Café",
          presentations: [{ id: "box", factor: new Prisma.Decimal(12) }],
        },
      ],
      updateMany: async ({
        data,
      }: {
        data: { stockQuantity?: { increment: Prisma.Decimal } };
      }) => {
        state.stock += data.stockQuantity?.increment.toNumber() ?? 0;
        return { count: 1 };
      },
    },
    stockEntry: {
      create: async ({
        data,
      }: {
        data: { items: { create: Record<string, unknown>[] } };
      }) => {
        state.items.push(...data.items.create);
        return { id: "entry", items: [...state.items].reverse() };
      },
      findFirst: async () => ({
        id: "entry",
        items: state.items.map((item) => ({
          ...item,
          product: { name: "Café" },
        })),
      }),
    },
    stockEntryItem: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: object;
      }) => {
        const item = state.items.find((row) => row.id === where.id);
        assert.ok(item);
        Object.assign(item, data);
      },
    },
    productBatch: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (state.batches.length === failBatchAt)
          throw new Error("batch unavailable");
        const batch = { ...data, id: `batch-${state.batches.length}` };
        state.batches.push(batch);
        return batch;
      },
    },
    inventoryMovement: {
      create: async () => {
        state.movements++;
        return { id: "movement" };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      const snapshot = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
  };
  const service = new StockEntriesService(
    prisma as never,
    { recordInMovement: async () => undefined } as never,
    { log: async () => undefined } as never,
    { notifyIfExpiring: async () => undefined } as never,
  );
  return { state, service };
}

test("recibe dos lotes del mismo producto sin duplicar stock y enlaza por ID aun con orden diferente", async () => {
  const { service, state } = fixture();
  await service.create("company-a", {
    items: [
      {
        productId: "p1",
        presentationId: "box",
        quantity: 2,
        unitCost: 24,
        batchNumber: "GS1-A",
        expiryDate: "2027-02-28",
      },
      {
        productId: "p1",
        quantity: 3,
        unitCost: 2,
        batchNumber: "GS1-B",
        expiryDate: "2028-02-29",
      },
    ],
  });
  assert.equal(state.stock, 37);
  assert.equal(state.batches.length, 2);
  assert.equal(state.batches[0].companyId, "company-a");
  assert.equal(String(state.batches[0].quantityAvailable), "24");
  assert.equal(String(state.batches[0].purchasePrice), "2");
  assert.equal(state.items[0].batchId, "batch-0");
  assert.equal(state.items[1].batchId, "batch-1");
  assert.equal(
    (state.batches[1].expirationDate as Date).toISOString(),
    "2028-02-29T00:00:00.000Z",
  );
});

test("con fecha sin lote genera identificador y un fallo de lote revierte entrada, stock y movimientos", async () => {
  const value = fixture();
  await value.service.create("company-a", {
    items: [
      { productId: "p1", quantity: 1, unitCost: 2, expiryDate: "2027-01-01" },
    ],
  });
  assert.equal(value.state.batches[0].batchNumber, "ENTRY-entry-1");
  const failing = fixture(1);
  await assert.rejects(
    failing.service.create("company-a", {
      items: [
        { productId: "p1", quantity: 1, unitCost: 2, batchNumber: "A" },
        { productId: "p1", quantity: 1, unitCost: 2, batchNumber: "B" },
      ],
    }),
    /batch unavailable/,
  );
  assert.equal(failing.state.stock, 10);
  assert.equal(failing.state.items.length, 0);
  assert.equal(failing.state.movements, 0);
});

test("rechaza productos ajenos, lotes vacíos y fechas imposibles antes de crear la entrada", async () => {
  for (const item of [
    { productId: "foreign", quantity: 1, unitCost: 2 },
    { productId: "p1", quantity: 1, unitCost: 2, batchNumber: "  " },
    { productId: "p1", quantity: 1, unitCost: 2, expiryDate: "2027-02-30" },
  ]) {
    const { state, service } = fixture();
    await assert.rejects(service.create("company-a", { items: [item] }));
    assert.equal(state.items.length, 0);
    assert.equal(state.stock, 10);
  }
});
