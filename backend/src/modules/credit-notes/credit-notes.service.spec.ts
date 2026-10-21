import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CreditNotesService } from "./credit-notes.service";

function dec(value: number) {
  return new Prisma.Decimal(value);
}

describe("CreditNotesService.create", () => {
  it("builds a credit note from the sale items when no items are provided", async () => {
    const sale = {
      id: "sale1",
      saleNumber: "S-001",
      subtotal: dec(100),
      taxAmount: dec(18),
      totalAmount: dec(118),
      items: [
        {
          productId: "p1",
          product: { name: "Producto 1" },
          quantity: dec(2),
          unitPrice: dec(50),
          totalPrice: dec(100),
        },
      ],
    };

    const created: any = {
      id: "cn1",
      companyId: "c1",
      saleId: "sale1",
      noteNumber: "NC-1",
      type: "CREDIT",
      reason: "DISCOUNT",
      status: "ISSUED",
      subtotal: dec(100),
      taxAmount: dec(18),
      totalAmount: dec(118),
      items: [
        {
          id: "i1",
          quantity: dec(2),
          unitPrice: dec(50),
          totalPrice: dec(100),
        },
      ],
    };

    const prisma: any = {
      sale: { findFirst: async () => sale },
      creditNote: {
        create: async () => created,
        findFirst: async () => created,
      },
      $transaction: async (fn: any) => fn(prisma),
    };
    const audits: any[] = [];
    const audit: any = { log: async (i: any) => audits.push(i) };

    const svc = new CreditNotesService(prisma, audit);
    const result = await svc.create("c1", "u1", {
      saleId: "sale1",
      reason: "DISCOUNT",
    });

    assert.strictEqual(result.totalAmount, 118);
    assert.strictEqual(result.subtotal, 100);
    assert.strictEqual(result.items[0].quantity, 2);
    assert.strictEqual(audits.length, 1);
    assert.strictEqual(audits[0].entity, "CreditNote");
  });

  it("throws NotFound when the sale does not belong to the company", async () => {
    const prisma: any = {
      sale: { findFirst: async () => null },
    };
    const audit: any = { log: async () => undefined };

    const svc = new CreditNotesService(prisma, audit);
    await assert.rejects(
      () => svc.create("c1", "u1", { saleId: "missing" }),
      NotFoundException,
    );
  });
});

describe("CreditNotesService.createFromRefund", () => {
  it("returns the existing note if a return note already exists", async () => {
    const existing = {
      id: "cn-existing",
      subtotal: dec(10),
      taxAmount: dec(0),
      totalAmount: dec(10),
      items: [],
    };
    const prisma: any = {
      creditNote: {
        findFirst: async () => ({ id: "cn-existing" }),
      },
    };
    const audit: any = { log: async () => undefined };
    const svc = new CreditNotesService(prisma, audit);
    svc.findOne = async () => existing as any;

    const result = await svc.createFromRefund("c1", "u1", "sale1");
    assert.strictEqual(result.id, "cn-existing");
  });

  it("creates a RETURN note when none exists", async () => {
    const sale = {
      id: "sale1",
      saleNumber: "S-001",
      subtotal: dec(50),
      taxAmount: dec(9),
      totalAmount: dec(59),
      items: [
        {
          productId: "p1",
          product: { name: "Producto 1" },
          quantity: dec(1),
          unitPrice: dec(50),
          totalPrice: dec(50),
        },
      ],
    };

    let createdReason: string | undefined;
    const created: any = {
      id: "cn2",
      subtotal: 50,
      taxAmount: 9,
      totalAmount: 59,
      items: [],
    };

    const prisma: any = {
      creditNote: {
        findFirst: async () => null,
        create: async (args: any) => {
          createdReason = args.data.reason;
          return created;
        },
      },
      sale: { findFirst: async () => sale },
      $transaction: async (fn: any) => fn(prisma),
    };
    const audit: any = { log: async () => undefined };

    const svc = new CreditNotesService(prisma, audit);
    svc.findOne = async () => created as any;

    const result = await svc.createFromRefund(
      "c1",
      "u1",
      "sale1",
      "defectuoso",
    );
    assert.strictEqual(createdReason, "RETURN");
    assert.strictEqual(result.totalAmount, 59);
  });
});

describe("CreditNotesService.updateStatus", () => {
  it("rejects changes to a cancelled note", async () => {
    const prisma: any = {
      creditNote: {
        findFirst: async () => ({ id: "cn1", status: "CANCELLED" }),
      },
    };
    const audit: any = { log: async () => undefined };
    const svc = new CreditNotesService(prisma, audit);

    await assert.rejects(
      () => svc.updateStatus("c1", "u1", "cn1", "APPLIED"),
      BadRequestException,
    );
  });

  it("updates the status and audits the change", async () => {
    const prisma: any = {
      creditNote: {
        findFirst: async () => ({ id: "cn1", status: "ISSUED" }),
        update: async () => undefined,
      },
    };
    const audits: any[] = [];
    const audit: any = { log: async (i: any) => audits.push(i) };
    const svc = new CreditNotesService(prisma, audit);
    svc.findOne = async () => ({ id: "cn1", status: "APPLIED" }) as any;

    const result = await svc.updateStatus("c1", "u1", "cn1", "APPLIED");
    assert.strictEqual(result.status, "APPLIED");
    assert.strictEqual(audits[0].changes.to, "APPLIED");
  });
});
