import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { Prisma } from "@prisma/client";
import { FifoStrategy } from "./fifo.strategy";
import { WeightedAverageStrategy } from "./weighted-average.strategy";

interface KardexEntry {
  qtyIn: Prisma.Decimal;
  qtyOut: Prisma.Decimal;
  unitCostIn: Prisma.Decimal | null;
  balanceQty: Prisma.Decimal;
  balanceUnitCost: Prisma.Decimal;
  movementDate: Date;
}

const zero = new Prisma.Decimal(0);

function entry(partial: Partial<KardexEntry>): KardexEntry {
  return {
    qtyIn: zero,
    qtyOut: zero,
    unitCostIn: null,
    balanceQty: zero,
    balanceUnitCost: zero,
    movementDate: new Date(),
    ...partial,
  };
}

const fifoTxOf = (entries: KardexEntry[]) =>
  ({
    inventoryKardex: {
      findMany: async () => entries,
      findFirst: async () => entries[entries.length - 1] ?? null,
    },
  }) as any;

describe("FifoStrategy", () => {
  it("consumes layers oldest-first", async () => {
    const entries = [
      entry({
        qtyIn: new Prisma.Decimal(10),
        unitCostIn: new Prisma.Decimal(5),
      }),
      entry({
        qtyIn: new Prisma.Decimal(10),
        unitCostIn: new Prisma.Decimal(8),
      }),
    ];
    const strategy = new FifoStrategy();

    const result = await strategy.calculateOutCost(
      "p1",
      new Prisma.Decimal(15),
      "c1",
      fifoTxOf(entries),
    );

    assert.equal(result.totalCost.toString(), "90");
    assert.equal(result.unitCost.toString(), "6");
  });

  it("skips already-consumed layers", async () => {
    const entries = [
      entry({
        qtyIn: new Prisma.Decimal(10),
        unitCostIn: new Prisma.Decimal(5),
      }),
      entry({ qtyOut: new Prisma.Decimal(10) }),
      entry({
        qtyIn: new Prisma.Decimal(10),
        unitCostIn: new Prisma.Decimal(8),
      }),
    ];
    const strategy = new FifoStrategy();

    const result = await strategy.calculateOutCost(
      "p1",
      new Prisma.Decimal(5),
      "c1",
      fifoTxOf(entries),
    );

    assert.equal(result.totalCost.toString(), "40");
    assert.equal(result.unitCost.toString(), "8");
  });

  it("throws when there are not enough layers", async () => {
    const entries = [
      entry({
        qtyIn: new Prisma.Decimal(3),
        unitCostIn: new Prisma.Decimal(5),
      }),
    ];
    const strategy = new FifoStrategy();

    await assert.rejects(
      () =>
        strategy.calculateOutCost(
          "p1",
          new Prisma.Decimal(5),
          "c1",
          fifoTxOf(entries),
        ),
      /Insufficient inventory layers/,
    );
  });
});

describe("WeightedAverageStrategy", () => {
  it("prices the outflow at the last balance unit cost", async () => {
    const entries = [
      entry({
        balanceQty: new Prisma.Decimal(20),
        balanceUnitCost: new Prisma.Decimal("6.5"),
      }),
    ];
    const strategy = new WeightedAverageStrategy();

    const result = await strategy.calculateOutCost(
      "p1",
      new Prisma.Decimal(4),
      "c1",
      fifoTxOf(entries),
    );

    assert.equal(result.unitCost.toString(), "6.5");
    assert.equal(result.totalCost.toString(), "26");
  });

  it("throws when there is no stock balance", async () => {
    const strategy = new WeightedAverageStrategy();
    const tx = {
      inventoryKardex: { findFirst: async () => null },
    } as any;

    await assert.rejects(
      () => strategy.calculateOutCost("p1", new Prisma.Decimal(1), "c1", tx),
      /No inventory balance/,
    );
  });

  it("throws when the balance quantity is zero", async () => {
    const entries = [
      entry({ balanceQty: zero, balanceUnitCost: new Prisma.Decimal(6) }),
    ];
    const strategy = new WeightedAverageStrategy();

    await assert.rejects(
      () =>
        strategy.calculateOutCost(
          "p1",
          new Prisma.Decimal(1),
          "c1",
          fifoTxOf(entries),
        ),
      /No inventory balance/,
    );
  });
});
