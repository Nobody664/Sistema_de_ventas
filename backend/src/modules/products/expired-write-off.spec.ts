import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { ProductsService } from "./products.service";

const d = (value: number) => new Prisma.Decimal(value);

test("da de baja lotes vencidos y registra la pérdida en finanzas", async () => {
  const writes: {
    batches: unknown[];
    product: unknown;
    movement: unknown;
    finance: unknown;
  } = { batches: [], product: null, movement: null, finance: null };
  let kardexQuantity: Prisma.Decimal | undefined;
  let auditChanges: unknown;

  const tx = {
    productBatch: {
      updateMany: async (args: unknown) => {
        writes.batches.push(args);
        return { count: 1 };
      },
    },
    product: {
      updateMany: async (args: unknown) => {
        writes.product = args;
        return { count: 1 };
      },
    },
    inventoryMovement: {
      create: async (args: { data: { quantity: Prisma.Decimal } }) => {
        writes.movement = args;
        return { id: "movement-1" };
      },
    },
    financeRecord: {
      create: async (args: unknown) => {
        writes.finance = args;
        return { id: "finance-1" };
      },
    },
  };

  const prisma = {
    product: {
      findFirst: async () => ({
        id: "p1",
        name: "Leche vencida",
        stockQuantity: d(10),
        expiryDate: null,
        deletedAt: null,
        company: { timezone: "America/Lima" },
        batches: [
          {
            id: "b1",
            batchNumber: "L-1",
            quantityAvailable: d(3),
            expirationDate: new Date("2020-01-01T00:00:00.000Z"),
            purchasePrice: d(2),
          },
          {
            id: "b2",
            batchNumber: "L-2",
            quantityAvailable: d(2),
            expirationDate: new Date("2021-01-01T00:00:00.000Z"),
            purchasePrice: d(2),
          },
        ],
      }),
    },
    $transaction: async (callback: (transaction: unknown) => unknown) =>
      callback(tx),
  } as never;

  const service = new ProductsService(
    prisma,
    {} as never,
    {} as never,
    {
      recordOutMovement: async (
        _companyId: string,
        _productId: string,
        quantity: Prisma.Decimal,
      ) => {
        kardexQuantity = quantity;
        return { unitCost: d(2), totalCost: quantity.mul(2) };
      },
    } as never,
    {
      log: async (entry: { changes: unknown }) => {
        auditChanges = entry.changes;
      },
    } as never,
  );

  const result = await service.writeOffExpiredStock(
    "company-1",
    "p1",
    "user-1",
  );

  assert.equal(result.quantity, 5);
  assert.equal(result.remainingStock, 5);
  assert.equal(result.lossAmount, 10);
  assert.equal(result.financeRecordId, "finance-1");
  assert.equal(kardexQuantity?.toNumber(), 5);
  assert.equal(writes.batches.length, 2);
  assert.deepEqual(writes.product, {
    where: { id: "p1", companyId: "company-1" },
    data: { stockQuantity: d(5), isActive: false },
  });
  assert.deepEqual(
    (writes.movement as { data: Record<string, unknown> }).data.quantity,
    d(-5),
  );
  assert.deepEqual((writes.finance as { data: Record<string, unknown> }).data, {
    companyId: "company-1",
    direction: "EXIT",
    category: "EXPIRY_LOSS",
    description: "Pérdida por vencimiento: Leche vencida",
    amount: d(10),
    recordDate: (writes.finance as { data: { recordDate: Date } }).data
      .recordDate,
    reference: "EXPIRY-p1",
    notes: "L-1: 3 (2020-01-01); L-2: 2 (2021-01-01). Movimiento movement-1.",
    createdById: "user-1",
  });
  assert.equal(
    (auditChanges as { reason: string; quantity: number }).reason,
    "EXPIRED_STOCK_WRITE_OFF",
  );
  assert.equal((auditChanges as { quantity: number }).quantity, 5);
});

test("rechaza la baja cuando no hay stock vencido", async () => {
  const prisma = {
    product: {
      findFirst: async () => ({
        id: "p1",
        name: "Leche",
        stockQuantity: d(10),
        expiryDate: null,
        deletedAt: null,
        company: { timezone: "America/Lima" },
        batches: [
          {
            id: "b1",
            batchNumber: "L-1",
            quantityAvailable: d(3),
            expirationDate: new Date("2999-01-01T00:00:00.000Z"),
            purchasePrice: d(2),
          },
        ],
      }),
    },
  } as never;

  const service = new ProductsService(
    prisma,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    () => service.writeOffExpiredStock("company-1", "p1"),
    /no tiene stock vencido/i,
  );
});
