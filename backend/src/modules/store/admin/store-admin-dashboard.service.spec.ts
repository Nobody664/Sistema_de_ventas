import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { StoreAdminDashboardService } from "./store-admin-dashboard.service";
import { StoreAdminContext } from "./store-admin-policy.service";

const context: StoreAdminContext = {
  mode: "MANAGE",
  company: {
    id: "company-1",
    name: "Bodega Central",
    slug: "bodega-central",
    timezone: "America/Lima",
    currency: "PEN",
    status: "ACTIVE",
  },
  store: {
    title: "Tienda Central",
    slug: "bodega-central",
    enabled: true,
    checkoutEnabled: true,
  },
  capabilities: {
    viewDashboard: true,
    manageOrders: true,
    managePayments: true,
    manageCatalog: true,
    manageCustomers: true,
    manageSettings: true,
    managePaymentsConfig: true,
    manageShippingConfig: true,
    manageRules: true,
    attendExistingOrders: true,
  },
  access: { attendExistingOrders: true },
  generatedAt: "2026-11-08T12:00:00.000Z",
};

function service() {
  let countCall = 0;
  let aggregateCall = 0;
  let rawCall = 0;
  const prisma = {
    storeOrder: {
      count: async () => [8, 4, 3, 5][countCall++] ?? 0,
      groupBy: async () => [
        { fulfillment: "READY_FOR_PICKUP", _count: { id: 2 } },
        { fulfillment: "SHIPPED", _count: { id: 1 } },
      ],
      findFirst: async () => ({
        createdAt: new Date("2026-11-04T18:00:00.000Z"),
      }),
    },
    sale: {
      aggregate: async () =>
        aggregateCall++ === 0
          ? {
              _count: { id: 7 },
              _sum: { totalAmount: new Prisma.Decimal("700.50") },
            }
          : {
              _count: { id: 3 },
              _sum: { totalAmount: new Prisma.Decimal("250.00") },
            },
    },
    $queryRaw: async () => {
      if (rawCall++ === 0)
        return [
          { day: "2026-11-02", count: 2 },
          { day: "2026-11-04", count: 1 },
        ];
      return [{ day: "2026-11-02", count: 1, amount: "700.50" }];
    },
  };
  return new StoreAdminDashboardService(prisma as never);
}

describe("StoreAdminDashboardService", () => {
  it("calcula el periodo en la zona horaria de la empresa y completa la tendencia", async () => {
    const dashboard = await service().get(context, {
      from: "2026-11-02",
      to: "2026-11-05",
    });
    assert.deepEqual(dashboard.range, {
      fromKey: "2026-11-02",
      toKey: "2026-11-04",
      from: "2026-11-02T05:00:00.000Z",
      toExclusive: "2026-11-05T05:00:00.000Z",
      timezone: "America/Lima",
    });
    assert.equal(dashboard.metrics.ordersCreated.value, 8);
    assert.equal(dashboard.metrics.ordersCreated.changePercent, 100);
    assert.equal(dashboard.metrics.onlineSales.amount, "700.5");
    assert.equal(dashboard.metrics.onlineSales.amountChangePercent, 180.2);
    assert.equal(dashboard.metrics.paymentsToReview.value, 3);
    assert.equal(dashboard.metrics.preparationPending.value, 5);
    assert.deepEqual(dashboard.deliveriesPending, {
      total: 3,
      pickups: 2,
      shipments: 1,
    });
    assert.deepEqual(dashboard.trend, [
      {
        date: "2026-11-02",
        ordersCreated: 2,
        onlineSalesCount: 1,
        onlineSalesAmount: "700.50",
      },
      {
        date: "2026-11-03",
        ordersCreated: 0,
        onlineSalesCount: 0,
        onlineSalesAmount: "0",
      },
      {
        date: "2026-11-04",
        ordersCreated: 1,
        onlineSalesCount: 0,
        onlineSalesAmount: "0",
      },
    ]);
  });

  it("rechaza rangos incompletos, invertidos o excesivos", async () => {
    await assert.rejects(
      () => service().get(context, { from: "2026-11-02" }),
      BadRequestException,
    );
    await assert.rejects(
      () =>
        service().get(context, {
          from: "2026-11-05",
          to: "2026-11-02",
        }),
      BadRequestException,
    );
    await assert.rejects(
      () =>
        service().get(context, {
          from: "2026-01-01",
          to: "2026-04-02",
        }),
      BadRequestException,
    );
  });
});
