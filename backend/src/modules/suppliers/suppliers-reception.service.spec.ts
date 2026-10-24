import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { KardexService } from "@/modules/kardex/kardex.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import { StockEntriesService } from "@/modules/stock-entries/stock-entries.service";
import { SuppliersService } from "./suppliers.service";

const receipt = { items: [{ productId: "product", quantity: 5, unitCost: 4 }] };

function fixture() {
  const state = {
    stock: 10,
    costs: 0,
    movements: 0,
    kardex: 0,
    audits: 0,
    order: {
      id: "order",
      companyId: "company",
      supplierId: "supplier",
      status: "SENT",
      reference: "PO-1",
      totalEstimated: null,
      receivedAt: null as Date | null,
      stockEntryId: null as string | null,
      receiptFingerprint: null as string | null,
      requestedQuantity: 5,
      receivedQuantity: 0,
    },
    entries: [] as {
      id: string;
      supplierId: string;
      items: {
        productId: string;
        quantity: number;
        unitCost: number;
        expiryDate: null;
      }[];
    }[],
  };
  let failCosts = false;
  let txRuns = 0;
  const asOrder = () => ({
    ...state.order,
    items: [
      {
        productId: "product",
        requestedQuantity: new Prisma.Decimal(state.order.requestedQuantity),
        suggestedQuantity: new Prisma.Decimal(5),
        receivedQuantity: new Prisma.Decimal(state.order.receivedQuantity),
        unitCost: new Prisma.Decimal(4),
      },
    ],
  });
  const tx = {
    supplierOrder: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; companyId: string };
      }) =>
        where.id === state.order.id && where.companyId === state.order.companyId
          ? asOrder()
          : null,
      updateMany: async ({
        data,
      }: {
        data: { status: string; receivedAt?: Date };
      }) => {
        if (
          state.order.stockEntryId ||
          state.order.status === "CANCELLED" ||
          state.order.status === "CONFIRMED"
        )
          return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      },
      update: async ({
        data,
      }: {
        data: { stockEntryId: string; receiptFingerprint: string };
      }) => {
        Object.assign(state.order, data);
        return asOrder();
      },
    },
    supplierOrderItem: {
      updateMany: async ({
        data,
      }: {
        data: { receivedQuantity: Prisma.Decimal };
      }) => {
        state.order.receivedQuantity = data.receivedQuantity.toNumber();
        return { count: 1 };
      },
    },
    supplierProduct: {
      updateMany: async () => {
        if (failCosts) throw new Error("cost write failed");
        state.costs++;
        return { count: 1 };
      },
    },
    supplier: { findFirst: async () => ({ id: "supplier" }) },
    product: {
      findMany: async () => [
        { id: "product", name: "Product", presentations: [] },
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
        data: {
          supplierId: string;
          items: {
            create: {
              productId: string;
              quantity: Prisma.Decimal;
              unitCost: Prisma.Decimal;
            }[];
          };
        };
      }) => {
        const entry = {
          id: `entry-${state.entries.length}`,
          supplierId: data.supplierId,
          items: data.items.create.map((item) => ({
            productId: item.productId,
            quantity: item.quantity.toNumber(),
            unitCost: item.unitCost.toNumber(),
            expiryDate: null,
          })),
        };
        state.entries.push(entry);
        return entry;
      },
      findFirst: async ({ where }: { where: { id: string } }) => {
        const entry = state.entries.find((value) => value.id === where.id);
        return entry
          ? {
              ...entry,
              items: entry.items.map((item) => ({
                ...item,
                product: { name: "Product" },
              })),
            }
          : null;
      },
    },
    inventoryMovement: {
      create: async () => {
        state.movements++;
        return { id: `movement-${state.movements}` };
      },
    },
  };
  let queue = Promise.resolve();
  const prisma = {
    $transaction: <T>(
      work: (client: typeof tx) => Promise<T>,
      options: { isolationLevel: string },
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      const result = queue.then(async () => {
        txRuns++;
        const old = structuredClone(state);
        try {
          return await work(tx);
        } catch (error) {
          Object.assign(state, old);
          throw error;
        }
      });
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  } as unknown as PrismaService;
  const audit = {
    log: async (_input: unknown, client: unknown) => {
      assert.equal(client, tx);
      state.audits++;
    },
  } as unknown as AuditService;
  const stock = new StockEntriesService(
    prisma,
    {
      recordInMovement: async (
        _company: unknown,
        _product: unknown,
        _qty: unknown,
        _cost: unknown,
        _movement: unknown,
        client: unknown,
      ) => {
        assert.equal(client, tx);
        state.kardex++;
      },
    } as unknown as KardexService,
    audit,
    {} as LowStockService,
  );
  const service = new SuppliersService(prisma, audit, stock);
  return {
    state,
    service,
    failCosts: () => {
      failCosts = true;
    },
    get transactions() {
      return txRuns;
    },
  };
}

describe("Atomic supplier reception using the real stock-entry service", () => {
  it("writes stock, kardex, supplier costs, order link and audit within one transaction", async () => {
    const value = fixture();
    const result = await value.service.receiveOrder(
      "company",
      "admin",
      "order",
      receipt,
    );
    assert.equal(value.transactions, 1);
    assert.equal(value.state.stock, 15);
    assert.equal(value.state.entries.length, 1);
    assert.equal(value.state.entries[0].supplierId, "supplier");
    assert.equal(value.state.kardex, 1);
    assert.equal(value.state.audits, 2);
    assert.equal(result.stockEntryId, "entry-0");
    assert.equal(result.status, "CONFIRMED");
    assert.equal(result.items[0].requestedQuantity, 5);
    assert.equal(result.items[0].receivedQuantity, 5);
  });

  it("returns the original receipt instead of adding stock again on simultaneous retries", async () => {
    const value = fixture();
    const results = await Promise.all([
      value.service.receiveOrder("company", "admin", "order", receipt),
      value.service.receiveOrder("company", "admin", "order", receipt),
    ]);
    assert.equal(results.filter((result) => result.alreadyReceived).length, 1);
    assert.equal(value.state.stock, 15);
    assert.equal(value.state.entries.length, 1);
    assert.equal(value.state.audits, 2);
  });

  it("rolls back the physical entry and order if the cost update fails later", async () => {
    const value = fixture();
    value.failCosts();
    await assert.rejects(
      value.service.receiveOrder("company", "admin", "order", receipt),
      /cost write failed/,
    );
    assert.equal(value.state.stock, 10);
    assert.equal(value.state.entries.length, 0);
    assert.equal(value.state.kardex, 0);
    assert.equal(value.state.order.status, "SENT");
    assert.equal(value.state.order.stockEntryId, null);
    assert.equal(value.state.audits, 0);
  });

  it("rejects missing, substituted, duplicated and partial lines before receiving", async () => {
    const value = fixture();
    for (const items of [
      [],
      [{ productId: "other-product", quantity: 5, unitCost: 4 }],
      [receipt.items[0], receipt.items[0]],
      [{ ...receipt.items[0], quantity: 3 }],
    ]) {
      await assert.rejects(
        value.service.receiveOrder("company", "admin", "order", { items }),
        BadRequestException,
      );
    }
    assert.equal(value.state.stock, 10);
    assert.equal(value.state.entries.length, 0);
  });

  it("rejects a changed receipt on retry and cannot mark a pending order confirmed without stock", async () => {
    const pending = fixture();
    await assert.rejects(
      pending.service.updateOrderStatus("company", "admin", "order", {
        status: "CONFIRMED",
      }),
      BadRequestException,
    );
    assert.equal(pending.state.stock, 10);
    await pending.service.receiveOrder("company", "admin", "order", receipt);
    await assert.rejects(
      pending.service.receiveOrder("company", "admin", "order", {
        items: [{ ...receipt.items[0], unitCost: 5 }],
      }),
      ConflictException,
    );
    assert.equal(pending.state.stock, 15);
  });

  it("does not allow cancellation to undo a completed physical reception", async () => {
    const value = fixture();
    const results = await Promise.allSettled([
      value.service.receiveOrder("company", "admin", "order", receipt),
      value.service.updateOrderStatus("company", "admin", "order", {
        status: "CANCELLED",
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(value.state.order.status, "CONFIRMED");
    assert.equal(value.state.stock, 15);
  });
});
