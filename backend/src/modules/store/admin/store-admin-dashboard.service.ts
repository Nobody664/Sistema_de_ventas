import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  companyDateKey,
  companyMidnight,
  companyTimeZone,
  shiftDateKey,
} from "@/common/helpers/company-timezone.helper";
import { StoreAdminDashboardQueryDto } from "./dto/store-admin.dto";
import { StoreAdminContext } from "./store-admin-policy.service";

const MAX_RANGE_DAYS = 90;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

interface DashboardRange {
  fromKey: string;
  toKey: string;
  from: Date;
  toExclusive: Date;
  days: number;
  timezone: string;
}

interface TrendRow {
  day: string;
  count: number | bigint;
}

interface SalesTrendRow extends TrendRow {
  amount: string;
}

export function paymentsToReviewWhere(
  companyId: string,
): Prisma.StoreOrderWhereInput {
  return {
    companyId,
    OR: [{ status: "REVIEW_REQUIRED" }, { paymentStatus: "UNDER_REVIEW" }],
  };
}

export function preparationPendingWhere(
  companyId: string,
  asOf: Date,
): Prisma.StoreOrderWhereInput {
  return {
    companyId,
    status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
    fulfillment: "UNFULFILLED",
    OR: [
      { paymentStatus: "PAID" },
      {
        snapshot: {
          path: ["payment", "code"],
          equals: "CASH_ON_PICKUP",
        },
        expiresAt: { gt: asOf },
      },
    ],
  };
}

@Injectable()
export class StoreAdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(context: StoreAdminContext, query: StoreAdminDashboardQueryDto) {
    const now = new Date();
    const timezone = companyTimeZone(context.company.timezone);
    const range = this.range(query, timezone, now);
    const previousRange = this.previousRange(range, timezone);
    const companyId = context.company.id;

    const currentSalesWhere: Prisma.SaleWhereInput = {
      companyId,
      createdAt: { gte: range.from, lt: range.toExclusive },
      status: "COMPLETED",
      channel: "ONLINE",
      storeOrder: { isNot: null },
    };
    const previousSalesWhere: Prisma.SaleWhereInput = {
      companyId,
      createdAt: {
        gte: previousRange.from,
        lt: previousRange.toExclusive,
      },
      status: "COMPLETED",
      channel: "ONLINE",
      storeOrder: { isNot: null },
    };

    const [
      ordersCreated,
      previousOrdersCreated,
      currentSales,
      previousSales,
      paymentsToReview,
      preparationPending,
      deliveryGroups,
      lastOrder,
      orderTrend,
      salesTrend,
    ] = await Promise.all([
      this.prisma.storeOrder.count({
        where: {
          companyId,
          createdAt: { gte: range.from, lt: range.toExclusive },
        },
      }),
      this.prisma.storeOrder.count({
        where: {
          companyId,
          createdAt: {
            gte: previousRange.from,
            lt: previousRange.toExclusive,
          },
        },
      }),
      this.prisma.sale.aggregate({
        where: currentSalesWhere,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.sale.aggregate({
        where: previousSalesWhere,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.storeOrder.count({
        where: paymentsToReviewWhere(companyId),
      }),
      this.prisma.storeOrder.count({
        where: preparationPendingWhere(companyId, now),
      }),
      this.prisma.storeOrder.groupBy({
        by: ["fulfillment"],
        where: {
          companyId,
          status: { notIn: ["CANCELLED", "EXPIRED"] },
          fulfillment: { in: ["READY_FOR_PICKUP", "SHIPPED"] },
        },
        _count: { id: true },
      }),
      this.prisma.storeOrder.findFirst({
        where: { companyId },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.$queryRaw<TrendRow[]>`
        SELECT to_char(
          (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
          'YYYY-MM-DD'
        ) AS day,
        COUNT(*)::int AS count
        FROM store_orders
        WHERE company_id = ${companyId}
          AND created_at >= ${range.from}
          AND created_at < ${range.toExclusive}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<SalesTrendRow[]>`
        SELECT to_char(
          (s.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}),
          'YYYY-MM-DD'
        ) AS day,
        COUNT(*)::int AS count,
        COALESCE(SUM(s.total_amount), 0)::text AS amount
        FROM sales s
        INNER JOIN store_orders so
          ON so.company_id = s.company_id AND so.sale_id = s.id
        WHERE s.company_id = ${companyId}
          AND s.status = 'COMPLETED'
          AND s.channel = 'ONLINE'
          AND s.created_at >= ${range.from}
          AND s.created_at < ${range.toExclusive}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const currentCount = Number(currentSales._count.id);
    const previousCount = Number(previousSales._count.id);
    const currentAmount = currentSales._sum.totalAmount?.toString() ?? "0";
    const previousAmount = previousSales._sum.totalAmount?.toString() ?? "0";

    const pickupsPending =
      deliveryGroups.find((group) => group.fulfillment === "READY_FOR_PICKUP")
        ?._count.id ?? 0;
    const shipmentsPending =
      deliveryGroups.find((group) => group.fulfillment === "SHIPPED")?._count
        .id ?? 0;

    return {
      mode: context.mode,
      generatedAt: now.toISOString(),
      range: {
        fromKey: range.fromKey,
        toKey: range.toKey,
        from: range.from.toISOString(),
        toExclusive: range.toExclusive.toISOString(),
        timezone: range.timezone,
      },
      previousRange: {
        fromKey: previousRange.fromKey,
        toKey: previousRange.toKey,
        from: previousRange.from.toISOString(),
        toExclusive: previousRange.toExclusive.toISOString(),
      },
      metrics: {
        ordersCreated: {
          value: ordersCreated,
          previous: previousOrdersCreated,
          changePercent: this.changePercent(
            ordersCreated,
            previousOrdersCreated,
          ),
        },
        onlineSales: {
          count: currentCount,
          amount: currentAmount,
          previousCount,
          previousAmount,
          amountChangePercent: this.changePercent(
            Number(currentAmount),
            Number(previousAmount),
          ),
        },
        paymentsToReview: { value: paymentsToReview },
        preparationPending: { value: preparationPending },
      },
      deliveriesPending: {
        total: pickupsPending + shipmentsPending,
        pickups: pickupsPending,
        shipments: shipmentsPending,
      },
      trend: this.trend(range, orderTrend, salesTrend),
      health: {
        lastOrderAt: lastOrder?.createdAt.toISOString() ?? null,
      },
    };
  }

  private range(
    query: StoreAdminDashboardQueryDto,
    timezone: string,
    now: Date,
  ): DashboardRange {
    if (Boolean(query.from) !== Boolean(query.to))
      throw new BadRequestException(
        "El rango debe incluir la fecha inicial y la fecha final",
      );

    let fromKey: string;
    let toKey: string;
    if (query.from && query.to) {
      fromKey = this.validDateKey(query.from);
      toKey = this.validDateKey(query.to);
    } else {
      const today = companyDateKey(now, timezone);
      fromKey = shiftDateKey(today, -6);
      toKey = shiftDateKey(today, 1);
    }

    const days = this.daysBetween(fromKey, toKey);
    if (days < 1)
      throw new BadRequestException(
        "La fecha final debe ser posterior a la fecha inicial",
      );
    if (days > MAX_RANGE_DAYS)
      throw new BadRequestException(
        `El rango máximo es de ${MAX_RANGE_DAYS} días`,
      );

    return {
      fromKey,
      toKey: shiftDateKey(toKey, -1),
      from: companyMidnight(fromKey, timezone),
      toExclusive: companyMidnight(toKey, timezone),
      days,
      timezone,
    };
  }

  private previousRange(
    range: DashboardRange,
    timezone: string,
  ): DashboardRange {
    const fromKey = shiftDateKey(range.fromKey, -range.days);
    return {
      fromKey,
      toKey: shiftDateKey(range.fromKey, -1),
      from: companyMidnight(fromKey, timezone),
      toExclusive: companyMidnight(range.fromKey, timezone),
      days: range.days,
      timezone,
    };
  }

  private validDateKey(value: string): string {
    if (!DATE_KEY.test(value))
      throw new BadRequestException("La fecha no tiene el formato esperado");
    const date = new Date(`${value}T00:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException("La fecha no es válida");
    return value;
  }

  private daysBetween(fromKey: string, toKey: string): number {
    const from = Date.parse(`${fromKey}T00:00:00Z`);
    const to = Date.parse(`${toKey}T00:00:00Z`);
    return Math.round((to - from) / 86_400_000);
  }

  private changePercent(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private trend(
    range: DashboardRange,
    orderRows: TrendRow[],
    salesRows: SalesTrendRow[],
  ) {
    const orders = new Map(
      orderRows.map((row) => [this.dayKey(row.day), Number(row.count)]),
    );
    const sales = new Map(
      salesRows.map((row) => [
        this.dayKey(row.day),
        { count: Number(row.count), amount: row.amount },
      ]),
    );
    const result: Array<{
      date: string;
      ordersCreated: number;
      onlineSalesCount: number;
      onlineSalesAmount: string;
    }> = [];
    for (
      let key = range.fromKey;
      key <= range.toKey;
      key = shiftDateKey(key, 1)
    ) {
      const sale = sales.get(key);
      result.push({
        date: key,
        ordersCreated: orders.get(key) ?? 0,
        onlineSalesCount: sale?.count ?? 0,
        onlineSalesAmount: sale?.amount ?? "0",
      });
    }
    return result;
  }

  private dayKey(value: string | Date): string {
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);
  }
}
