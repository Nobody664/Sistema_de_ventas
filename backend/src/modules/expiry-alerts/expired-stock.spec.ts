import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { expiredStockItems } from "./expired-stock";

const product = {
  id: "product-1",
  name: "Leche",
  stockQuantity: new Prisma.Decimal(10),
  expiryDate: null,
};

test("detecta lotes vencidos con stock disponible", () => {
  const items = expiredStockItems(
    product,
    [
      {
        id: "batch-1",
        batchNumber: "L-1",
        quantityAvailable: new Prisma.Decimal(3),
        expirationDate: new Date("2026-11-01T00:00:00.000Z"),
      },
      {
        id: "batch-2",
        batchNumber: "L-2",
        quantityAvailable: new Prisma.Decimal(0),
        expirationDate: new Date("2026-11-01T00:00:00.000Z"),
      },
    ],
    "America/Lima",
    new Date("2026-11-02T15:00:00.000Z"),
  );

  assert.deepEqual(items, [
    {
      productId: "product-1",
      productName: "Leche",
      batchId: "batch-1",
      batchNumber: "L-1",
      expiryDate: "2026-11-01",
      quantity: 3,
    },
  ]);
});

test("usa la fecha del producto solo cuando no hay lotes disponibles", () => {
  const expiringProduct = {
    ...product,
    expiryDate: new Date("2026-10-30T00:00:00.000Z"),
  };

  assert.deepEqual(
    expiredStockItems(
      expiringProduct,
      [
        {
          id: "batch-1",
          batchNumber: "L-1",
          quantityAvailable: new Prisma.Decimal(0),
          expirationDate: new Date("2026-11-01T00:00:00.000Z"),
        },
      ],
      "America/Lima",
      new Date("2026-11-02T15:00:00.000Z"),
    ),
    [
      {
        productId: "product-1",
        productName: "Leche",
        batchId: null,
        batchNumber: null,
        expiryDate: "2026-10-30",
        quantity: 10,
      },
    ],
  );
});

test("no marca la fecha del producto si existe un lote vigente con stock", () => {
  const expiringProduct = {
    ...product,
    expiryDate: new Date("2026-10-30T00:00:00.000Z"),
  };

  assert.deepEqual(
    expiredStockItems(
      expiringProduct,
      [
        {
          id: "batch-1",
          batchNumber: "L-1",
          quantityAvailable: new Prisma.Decimal(2),
          expirationDate: new Date("2026-12-31T00:00:00.000Z"),
        },
      ],
      "America/Lima",
      new Date("2026-11-02T15:00:00.000Z"),
    ),
    [],
  );
});

test("considera vencido el lote el día siguiente en la zona de la empresa", () => {
  const batch = {
    id: "batch-1",
    batchNumber: "L-1",
    quantityAvailable: new Prisma.Decimal(1),
    expirationDate: new Date("2026-11-02T00:00:00.000Z"),
  };

  assert.deepEqual(
    expiredStockItems(
      product,
      [batch],
      "America/Lima",
      new Date("2026-11-02T15:00:00.000Z"),
    ),
    [],
  );
  assert.deepEqual(
    expiredStockItems(
      product,
      [batch],
      "America/Lima",
      new Date("2026-11-03T15:00:00.000Z"),
    ),
    [
      {
        productId: "product-1",
        productName: "Leche",
        batchId: "batch-1",
        batchNumber: "L-1",
        expiryDate: "2026-11-02",
        quantity: 1,
      },
    ],
  );
});
