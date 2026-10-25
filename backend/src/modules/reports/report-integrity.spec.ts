import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { ReportsService } from "./reports.service";
import { FinanceService } from "@/modules/finance/finance.service";
import { financeLedger } from "@/modules/finance/finance-query.helper";

describe("Exhaustive and scoped financial reads", () => {
  it("includes more than 1000 completed sales in the trend and shares state, date, seller and channel filters", async () => {
    const queries: Prisma.SaleWhereInput[] = [];
    const prisma = {
      sale: {
        count: async ({ where }: { where: Prisma.SaleWhereInput }) => {
          queries.push(where);
          return 1205;
        },
        aggregate: async ({ where }: { where: Prisma.SaleWhereInput }) => {
          queries.push(where);
          return {
            _count: { id: 1205 },
            _sum: { totalAmount: new Prisma.Decimal(12050) },
          };
        },
        groupBy: async ({ where }: { where: Prisma.SaleWhereInput }) => {
          queries.push(where);
          return [
            {
              channel: "POS",
              _count: { id: 1205 },
              _sum: { totalAmount: new Prisma.Decimal(12050) },
            },
          ];
        },
      },
      customer: { count: async () => 0 },
      saleItem: { groupBy: async () => [] },
      product: { findMany: async () => [] },
    } as unknown as PrismaService;
    const service = new ReportsService(prisma, {
      get: async () => null,
      set: async () => undefined,
    } as never);
    const result = await service.getSalesOverview(
      "company",
      { channel: "POS", startDate: "2026-10-01", endDate: "2026-10-07" },
      { userId: "seller", roles: ["CASHIER"] },
    );
    assert.equal(result.totalSales, 1205);
    assert.equal(result.totalRevenue, 12050);
    assert.equal(result.salesByDay.at(-1)?.sales, 1205);
    for (const query of queries) {
      const scope = Array.isArray(query.AND) ? query.AND[0] : query;
      assert.equal(scope.companyId, "company");
      assert.equal(scope.sellerId, "seller");
      assert.equal(scope.status, "COMPLETED");
      assert.equal(scope.channel, "POS");
    }
    assert.deepEqual(result.byChannel, [
      { channel: "POS", sales: 1205, revenue: 12050 },
    ]);
  });
  it("paginates the union in PostgreSQL beyond the old 500-row boundary with a stable tie breaker", async () => {
    const sql: Prisma.Sql[] = [];
    const date = new Date("2026-01-01");
    const tx = {
      $queryRaw: async (query: Prisma.Sql) => {
        sql.push(query);
        if (query.text.includes("count(*) AS total")) return [{ total: 1205n }];
        return [
          {
            id: "row-600",
            source: "MANUAL",
            direction: "ENTRY",
            category: "PURCHASE",
            description: "Compra",
            amount: new Prisma.Decimal(10),
            currency: "USD",
            recordDate: date,
            dueDate: null,
            reference: null,
            supplier: null,
            notes: null,
            employeeId: null,
            employeeName: null,
            createdAt: date,
          },
        ];
      },
    };
    const prisma = {
      $transaction: async <T>(
        work: (value: typeof tx) => Promise<T>,
        options: { isolationLevel: string },
      ) => {
        assert.equal(options.isolationLevel, "RepeatableRead");
        return work(tx);
      },
    } as unknown as PrismaService;
    const result = await new FinanceService(prisma, {} as never).findAll(
      "company",
      { page: 31, limit: 20, currency: "USD" },
    );
    assert.equal(result.total, 1205);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].currency, "USD");
    assert.match(sql[0].text, /UNION ALL/);
    assert.match(sql[0].text, /f\.source ASC, f\.id ASC LIMIT/);
    assert.deepEqual(sql[0].values.slice(-2), [20, 600]);
  });
  it("keeps tenant, currency and search values parameterized instead of injecting SQL", () => {
    const query = financeLedger(
      "tenant",
      { currency: "USD", search: "'; DROP TABLE sales; --" },
      {},
    );
    assert.ok(!query.text.includes("DROP TABLE"));
    assert.ok(query.values.includes("USD"));
    assert.ok(query.values.includes("tenant"));
    assert.match(query.text, /status = 'COMPLETED'/);
  });
  it("summarizes a single explicit currency in database-grouped weekly buckets", async () => {
    const prisma = {
      $queryRaw: async (query: Prisma.Sql) => {
        assert.ok(query.values.includes("USD"));
        assert.match(query.text, /GROUP BY direction, category/);
        return [
          {
            direction: "ENTRY",
            category: "PURCHASE",
            amount: new Prisma.Decimal("20.10"),
            count: 2n,
            week: new Date("2026-10-05"),
          },
        ];
      },
    } as unknown as PrismaService;
    const result = await new FinanceService(prisma, {} as never).getSummary(
      "company",
      { currency: "USD", from: "2026-10-01", to: "2026-10-31" },
    );
    assert.equal(result.currency, "USD");
    assert.equal(result.entries.total, 20.1);
    assert.equal(result.entries.count, 2);
    assert.equal(result.weeks.length, 1);
  });
});
