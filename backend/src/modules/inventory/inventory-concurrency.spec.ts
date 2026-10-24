import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { InventoryService } from "./inventory.service";

describe("Inventory conditional outflow", () => {
  it("cannot drive stock negative when two requests saw the same old balance", async () => {
    let stock = new Prisma.Decimal(10);
    let movements = 0;
    const tx = {
      product: {
        updateMany: async ({
          where,
          data,
        }: {
          where: { stockQuantity: { gte: Prisma.Decimal } };
          data: { stockQuantity: { increment: Prisma.Decimal } };
        }) => {
          if (stock.lt(where.stockQuantity.gte)) return { count: 0 };
          stock = stock.plus(data.stockQuantity.increment);
          return { count: 1 };
        },
        findUnique: async () => ({ stockQuantity: stock }),
      },
      inventoryMovement: {
        create: async () => {
          movements++;
          return { id: "move", reason: "manual" };
        },
      },
    };
    const prisma = {
      product: {
        findFirst: async () => ({
          id: "p",
          name: "P",
          stockQuantity: new Prisma.Decimal(10),
          minStock: new Prisma.Decimal(0),
          costPrice: new Prisma.Decimal(1),
        }),
      },
      $transaction: async <T>(work: (client: typeof tx) => Promise<T>) =>
        work(tx),
    } as unknown as PrismaService;
    const service = new InventoryService(
      prisma,
      { log: async () => undefined } as never,
      { recordOutMovement: async () => undefined } as never,
      { notifyIfLowStock: async () => undefined } as never,
      { reserveFromBatch: async () => undefined } as never,
    );
    const results = await Promise.allSettled([
      service.adjustStock("company", {
        productId: "p",
        type: "OUT",
        quantity: 7,
      }),
      service.adjustStock("company", {
        productId: "p",
        type: "OUT",
        quantity: 7,
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(stock.toString(), "3");
    assert.equal(movements, 1);
  });
});
