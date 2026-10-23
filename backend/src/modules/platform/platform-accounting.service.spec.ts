import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PlatformApiUsageService } from "./platform-api-usage.service";
import { PlatformFinanceService } from "./platform-finance.service";

function billingFixture(
  options: { billed?: boolean; currency?: string; claimed?: number } = {},
) {
  let writes = 0;
  let committedAmount = "";
  const tx = {
    platformAccount: {
      findUnique: async () => ({
        id: "account",
        isActive: true,
        currency: "USD",
      }),
    },
    apiUsageRecord: {
      findMany: async () => [
        {
          id: "a",
          billed: options.billed ?? false,
          currency: options.currency ?? "USD",
          cost: new Prisma.Decimal("0.1"),
        },
        {
          id: "b",
          billed: false,
          currency: "USD",
          cost: new Prisma.Decimal("0.2"),
        },
      ],
      updateMany: async () => ({ count: options.claimed ?? 2 }),
    },
    platformTransaction: {
      create: async ({ data }: { data: { amount: Prisma.Decimal } }) => {
        writes++;
        committedAmount = data.amount.toString();
        return { id: "transaction", ...data };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(
      work: (client: typeof tx) => Promise<T>,
    ): Promise<T> => work(tx),
  };
  return {
    service: new PlatformApiUsageService(prisma as unknown as PrismaService),
    get writes() {
      return writes;
    },
    get amount() {
      return committedAmount;
    },
  };
}

describe("Platform API accounting", () => {
  it("rejects already-accounted consumption before creating another expense", async () => {
    const fixture = billingFixture({ billed: true });
    await assert.rejects(
      fixture.service.billRecords(
        { accountId: "account", recordIds: ["a", "b"] },
        "admin",
      ),
      ConflictException,
    );
    assert.equal(fixture.writes, 0);
  });

  it("does not mix currencies in a platform account", async () => {
    const fixture = billingFixture({ currency: "PEN" });
    await assert.rejects(
      fixture.service.billRecords(
        { accountId: "account", recordIds: ["a", "b"] },
        "admin",
      ),
      BadRequestException,
    );
    assert.equal(fixture.writes, 0);
  });

  it("adds decimal costs exactly and returns the accounted record count", async () => {
    const fixture = billingFixture();
    const result = await fixture.service.billRecords(
      { accountId: "account", recordIds: ["a", "b"] },
      "admin",
    );
    assert.equal(fixture.amount, "0.3");
    assert.equal(result.amount, 0.3);
    assert.equal(result.records, 2);
  });

  it("throws within the transaction when another request claims the records", async () => {
    const fixture = billingFixture({ claimed: 0 });
    await assert.rejects(
      fixture.service.billRecords(
        { accountId: "account", recordIds: ["a", "b"] },
        "admin",
      ),
      ConflictException,
    );
  });
});

describe("Platform finance totals", () => {
  it("filters subscriptions and manual movements to the requested currency", async () => {
    const currencyQueries: string[] = [];
    const prisma = {
      platformAccount: { findMany: async () => [] },
      payment: {
        findMany: async ({ where }: { where: { currency: string } }) => {
          currencyQueries.push(where.currency);
          return [{ amount: new Prisma.Decimal(100), createdAt: new Date() }];
        },
      },
      platformTransaction: {
        findMany: async ({ where }: { where: { currency: string } }) => {
          currencyQueries.push(where.currency);
          return [
            {
              type: "EXPENSE",
              amount: new Prisma.Decimal(25),
              occurredAt: new Date(),
              category: "API",
            },
          ];
        },
        groupBy: async () => [],
      },
    };
    const service = new PlatformFinanceService(
      prisma as unknown as PrismaService,
    );
    const result = await service.getSummary({ currency: "USD" });
    assert.deepEqual(currencyQueries, ["USD", "USD", "USD", "USD"]);
    assert.equal(result.currency, "USD");
    assert.equal(result.totals.net, 75);
  });

  it("rejects an inverted date range before querying the database", async () => {
    const service = new PlatformFinanceService({} as PrismaService);
    await assert.rejects(
      service.getSummary({ from: "2026-12-01", to: "2026-01-01" }),
      BadRequestException,
    );
  });
});
