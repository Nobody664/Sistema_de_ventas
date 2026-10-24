import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { SalesService } from "./sales.service";
import { CreditNotesService } from "@/modules/credit-notes/credit-notes.service";
import { creditAmounts } from "@/modules/credit-notes/credit-note-amounts.helper";

const d = (n: number) => new Prisma.Decimal(n);
function fixture(distributed = false, failNote = false) {
  const state = {
    status: "COMPLETED",
    stock: 10,
    consigned: 0,
    sold: 24,
    batches: 0,
    notes: 0,
    audits: 0,
  };
  let noteData:
    | { totalAmount: Prisma.Decimal; subtotal: Prisma.Decimal }
    | undefined;
  const sale = () => ({
    id: "sale",
    saleNumber: "S-1",
    status: state.status,
    channel: distributed ? "DISTRIBUTOR" : "POS",
    distributorId: distributed ? "dist" : null,
    notes: null,
    subtotal: d(100),
    discountAmount: d(20),
    taxAmount: d(18),
    totalAmount: d(98),
    items: [
      {
        productId: "p",
        presentationId: "box",
        baseQuantity: d(24),
        unitFactor: d(12),
        unitCostSnapshot: d(3),
        quantity: d(2),
        unitPrice: d(50),
        totalPrice: d(100),
        product: { name: "Product" },
      },
    ],
  });
  const tx = {
    sale: {
      findFirst: async () => sale(),
      findUnique: async () => sale(),
      updateMany: async ({ data }: { data: { status: string } }) => {
        if (state.status !== "COMPLETED") return { count: 0 };
        state.status = data.status;
        return { count: 1 };
      },
    },
    product: {
      findMany: async () => [
        {
          id: "p",
          costPrice: d(999),
          expiryDate: null,
          presentations: [{ id: "box", factor: d(999) }],
        },
      ],
      update: async ({
        data,
      }: {
        data: { stockQuantity: { increment: Prisma.Decimal } };
      }) => {
        state.stock += data.stockQuantity.increment.toNumber();
      },
    },
    productBatch: {
      create: async () => {
        state.batches++;
      },
    },
    inventoryMovement: { create: async () => ({ id: "movement" }) },
    distributor: { findFirst: async () => ({ stockReconciled: true }) },
    distributorStock: {
      upsert: async ({ create }: { create: { quantity: Prisma.Decimal } }) => {
        state.consigned += create.quantity.toNumber();
      },
    },
    distributorBalance: {
      updateMany: async ({
        data,
      }: {
        data: { soldQuantity: { decrement: Prisma.Decimal } };
      }) => {
        state.sold -= data.soldQuantity.decrement.toNumber();
        return { count: 1 };
      },
    },
    creditNote: {
      findFirst: async () => null,
      aggregate: async () => ({ _sum: { totalAmount: d(0), taxAmount: d(0) } }),
      create: async ({
        data,
      }: {
        data: {
          totalAmount: Prisma.Decimal;
          subtotal: Prisma.Decimal;
          items: { create: unknown[] };
        };
      }) => {
        if (failNote) throw new Error("note unavailable");
        noteData = data;
        state.notes++;
        return { id: "note", ...data, items: data.items.create };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      const old = { ...state };
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, old);
        throw error;
      }
    },
  } as unknown as PrismaService;
  const audit = {
    log: async (_data: unknown, client: unknown) => {
      assert.equal(client, tx);
      state.audits++;
    },
  } as unknown as AuditService;
  const credit = new CreditNotesService(prisma, audit);
  const service = new SalesService(
    prisma,
    {} as never,
    {} as never,
    { recordInMovement: async () => undefined } as never,
    {} as never,
    audit,
    {} as never,
    {} as never,
    {} as never,
    credit,
  );
  return {
    state,
    service,
    get note() {
      return noteData;
    },
  };
}

describe("Complete sale reversals", () => {
  it("uses historical base units and issues exactly the discounted amount paid", async () => {
    const value = fixture();
    await value.service.refundSale("company", "sale", "admin");
    assert.equal(value.state.stock, 34);
    assert.equal(value.state.batches, 1);
    assert.equal(value.note?.subtotal.toString(), "80");
    assert.equal(value.note?.totalAmount.toString(), "98");
    await value.service.refundSale("company", "sale", "admin");
    assert.equal(value.state.stock, 34);
    assert.equal(value.state.notes, 1);
  });
  it("rolls back inventory and status if the credit note fails", async () => {
    const value = fixture(false, true);
    await assert.rejects(
      value.service.refundSale("company", "sale", "admin"),
      /note unavailable/,
    );
    assert.equal(value.state.stock, 10);
    assert.equal(value.state.status, "COMPLETED");
    assert.equal(value.state.batches, 0);
  });
  it("returns distributor goods to their own balance, not to the central warehouse", async () => {
    const value = fixture(true);
    await value.service.refundSale("company", "sale", "admin");
    assert.equal(value.state.stock, 10);
    assert.equal(value.state.consigned, 24);
    assert.equal(value.state.sold, 0);
    assert.equal(value.state.batches, 0);
  });
  it("prorates partial tax/discount and leaves only the uncredited remainder for the full return", () => {
    const original = {
      subtotal: d(100),
      discountAmount: d(20),
      taxAmount: d(18),
      totalAmount: d(98),
    };
    const partial = creditAmounts(
      original,
      d(50),
      { total: d(0), tax: d(0) },
      false,
      true,
    );
    assert.equal(partial.totalAmount.toString(), "49");
    assert.equal(partial.taxAmount.toString(), "9");
    const remaining = creditAmounts(
      original,
      d(100),
      { total: d(49), tax: d(9) },
      true,
      true,
    );
    assert.equal(remaining.totalAmount.toString(), "49");
  });
});
