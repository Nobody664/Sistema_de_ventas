import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { DashboardService } from "./dashboard.service";
import { PlatformApiUsageService } from "@/modules/platform/platform-api-usage.service";

const cache = { get: async () => null, set: async () => undefined };

describe("Metric coverage and monetary scope", () => {
  it("uses exhaustive totals while identifying capped dashboard breakdowns", async () => {
    const prisma = {
      sale: {
        aggregate: async () => ({
          _sum: { totalAmount: new Prisma.Decimal(12000) },
          _count: { id: 1200 },
        }),
        findMany: async ({
          take,
          where,
        }: {
          take: number;
          where: { status: string; sellerId: string };
        }) => {
          assert.equal(where.status, "COMPLETED");
          assert.equal(where.sellerId, "seller");
          return take === 25
            ? []
            : Array.from({ length: 500 }, () => ({
                id: "sale",
                createdAt: new Date(),
                totalAmount: new Prisma.Decimal(10),
                paymentMethod: "CASH",
                customer: null,
              }));
        },
      },
      product: { count: async () => 10001, findMany: async () => [] },
      customer: { count: async () => 0 },
      employee: { count: async () => 0 },
      company: {
        findUnique: async () => ({ name: "Empresa", currency: "PEN" }),
      },
    } as unknown as PrismaService;
    const result = await new DashboardService(
      prisma,
      cache as never,
    ).getTenantMetrics("company", { userId: "seller", roles: ["CASHIER"] });
    assert.equal(result?.salesAnalytics.totalSales, 1200);
    assert.equal(result?.salesAnalytics.totalRevenue, 12000);
    assert.equal(result?.dataCoverage.sales.truncated, true);
    assert.equal(result?.dataCoverage.inventory.truncated, true);
  });
  it("separates collected currencies and weights recurring revenue by the contracted cycle", async () => {
    const prisma = {
      company: { count: async () => 1 },
      subscription: {
        groupBy: async () => [
          { planId: "plan", billingCycle: "MONTHLY", _count: { _all: 2 } },
          { planId: "plan", billingCycle: "YEARLY", _count: { _all: 1 } },
        ],
      },
      payment: {
        groupBy: async () => [
          { currency: "PEN", _sum: { amount: new Prisma.Decimal(10) } },
          { currency: "USD", _sum: { amount: new Prisma.Decimal(20) } },
        ],
      },
      plan: {
        findMany: async () => [
          { id: "plan", priceMonthly: 10, priceYearly: 120 },
        ],
      },
    } as unknown as PrismaService;
    const result = await new DashboardService(
      prisma,
      cache as never,
    ).getGlobalMetrics();
    assert.equal(result.collectedRevenue, 10);
    assert.deepEqual(result.collectedRevenueByCurrency, { PEN: 10, USD: 20 });
    assert.equal(result.monthlyRecurringRevenue, 30);
    assert.equal(result.annualRecurringRevenue, 360);
  });
  it("bounds platform company pages and groups usage without loading individual records or mixing currencies", async () => {
    const prisma = {
      company: {
        count: async () => 101,
        findMany: async (query: { take: number; skip: number }) => {
          assert.equal(query.take, 20);
          assert.equal(query.skip, 20);
          return [{ id: "company", name: "Empresa" }];
        },
      },
      apiUsage: {
        findMany: async () => [{ companyId: "company", count: 3, tokens: 10 }],
      },
      apiUsageRecord: {
        groupBy: async () =>
          ["USD", "PEN"].map((currency) => ({
            companyId: "company",
            providerId: "provider",
            currency,
            _sum: { tokens: 5, cost: new Prisma.Decimal(1) },
            _count: { _all: 1 },
          })),
      },
      apiProvider: {
        count: async () => 1,
        findMany: async () => [
          {
            id: "provider",
            name: "API",
            slug: "api",
            unit: "tokens",
            costPerUnit: new Prisma.Decimal(1),
          },
        ],
      },
      subscription: {
        findMany: async () => [
          {
            companyId: "company",
            planId: "plan",
            plan: {
              id: "plan",
              code: "PRO",
              name: "Pro",
              apiQuota: 10,
              apiEnabled: true,
            },
          },
        ],
      },
    } as unknown as PrismaService;
    const result = await new PlatformApiUsageService(prisma).getSummary({
      page: 2,
      limit: 20,
      period: "2026-10",
    });
    assert.equal(result.total, 101);
    assert.equal(result.totalsScope, "PAGE");
    assert.deepEqual(result.totals.costsByCurrency, { USD: 1, PEN: 1 });
    assert.equal(result.providers.length, 2);
  });
});
