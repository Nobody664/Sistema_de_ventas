import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  debitDistributorStock,
  requireDistributorStock,
} from "./distributor-stock.helper";

describe("Consigned product stock", () => {
  it("does not use another product's aggregate balance to fulfill a sale", async () => {
    let selected: unknown;
    const tx = {
      distributorStock: {
        updateMany: async ({ where }: { where: unknown }) => {
          selected = where;
          return { count: 0 };
        },
      },
    } as unknown as Prisma.TransactionClient;
    await assert.rejects(
      debitDistributorStock(
        tx,
        "dist",
        "missing-product",
        new Prisma.Decimal(2),
      ),
      BadRequestException,
    );
    assert.deepEqual(selected, {
      distributorId: "dist",
      productId: "missing-product",
      quantity: { gte: new Prisma.Decimal(2) },
    });
  });
  it("fails closed for legacy aggregates without an audited product reconciliation", async () => {
    const tx = {
      distributor: { findFirst: async () => ({ stockReconciled: false }) },
    } as unknown as Prisma.TransactionClient;
    await assert.rejects(
      requireDistributorStock(tx, "company", "dist"),
      ConflictException,
    );
  });
});
