import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { StoreStockService } from "./store-stock.service";

test("reservar muchos productos agrupa bloqueos y escrituras sin multiplicar viajes a la base de datos", async () => {
  for (const size of [2, 50]) {
    let queries = 0;
    let saved: Prisma.StockReservationAllocationCreateManyInput[] = [];
    const products = Array.from({ length: size }, (_, index) => ({
      id: `p-${index}`,
      name: `Producto ${index}`,
      stockQuantity: new Prisma.Decimal(10),
      reservedQuantity: new Prisma.Decimal(0),
      expiryDate: null,
      costPrice: null,
    }));
    const batches = products.map((product) => ({
      id: `batch-${product.id}`,
      productId: product.id,
      quantityAvailable: new Prisma.Decimal(10),
      reservedQuantity: new Prisma.Decimal(0),
      expirationDate: null,
    }));
    const tx = {
      company: {
        findUniqueOrThrow: async () => {
          queries++;
          return { timezone: "UTC" };
        },
      },
      $queryRaw: async () => {
        queries++;
        return [];
      },
      $executeRaw: async () => {
        queries++;
        return size;
      },
      product: {
        findMany: async () => {
          queries++;
          return products;
        },
      },
      productBatch: {
        findMany: async () => {
          queries++;
          return batches;
        },
      },
      stockReservation: {
        createManyAndReturn: async ({
          data,
        }: {
          data: { productId: string }[];
        }) => {
          queries++;
          return data.map((line) => ({
            id: `reservation-${line.productId}`,
            productId: line.productId,
          }));
        },
      },
      stockReservationAllocation: {
        createMany: async ({
          data,
        }: {
          data: Prisma.StockReservationAllocationCreateManyInput[];
        }) => {
          queries++;
          saved = data;
          return { count: data.length };
        },
      },
    };
    await new StoreStockService({} as never).hold(
      tx as never,
      "company-a",
      "order-a",
      products.map((product, index) => ({
        productId: product.id,
        baseQuantity: String(index % 2 ? 2 : 3),
      })),
      new Date(Date.now() + 60000),
    );
    assert.equal(queries, 9);
    assert.equal(saved.length, size);
    for (const allocation of saved) {
      const index = Number(allocation.productId.slice(2));
      assert.equal(allocation.companyId, "company-a");
      assert.equal(allocation.batchId, `batch-p-${index}`);
      assert.equal(allocation.reservationId, `reservation-p-${index}`);
      assert.equal(allocation.quantity.toString(), String(index % 2 ? 2 : 3));
    }
  }
});
