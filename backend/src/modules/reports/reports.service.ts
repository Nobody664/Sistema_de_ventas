import { Injectable } from "@nestjs/common";
import { Prisma, SaleChannel } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import {
  SalesActor,
  salesAudienceKey,
  salesVisibility,
  canReadCompanySales,
} from "@/common/helpers/sales-visibility.helper";
import { ReportsOverviewQueryDto } from "./dto/reports-query.dto";
import { dateRange } from "@/common/helpers/query-bounds.helper";
import {
  companyDateKey,
  companyDay,
  companyMidnight,
  companyTimeZone,
  shiftDateKey,
} from "@/common/helpers/company-timezone.helper";

type SalesByChannel = {
  channel: SaleChannel;
  sales: number;
  revenue: number;
};

type SalesOverview = {
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  averageTicket: number;
  revenueChange: number;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByDay: Array<{ date: string; sales: number; revenue: number }>;
  byChannel: SalesByChannel[];
  filters: {
    salesScope: "COMPANY" | "SELLER";
    channel: SaleChannel | null;
    startDate: string | null;
    endDate: string | null;
  };
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSalesOverview(
    companyId: string,
    query: ReportsOverviewQueryDto = {},
    actor: SalesActor,
  ): Promise<SalesOverview> {
    const channel = query.channel;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const zone = companyTimeZone(company?.timezone);
    const validated = dateRange(query.startDate, query.endDate, 30);
    const now = new Date();
    const today = companyDay(now, zone);
    const dateOnly = (value?: string) =>
      !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const endDate = query.endDate
      ? dateOnly(query.endDate)
        ? new Date(
            companyMidnight(shiftDateKey(query.endDate, 1), zone).getTime() - 1,
          )
        : validated.to!
      : new Date(today.end.getTime() - 1);
    const startDate = query.startDate
      ? dateOnly(query.startDate)
        ? companyMidnight(query.startDate, zone)
        : validated.from!
      : companyMidnight(shiftDateKey(companyDateKey(endDate, zone), -29), zone);
    dateRange(startDate.toISOString(), endDate.toISOString());

    const visibility = salesVisibility(companyId, actor);
    const cacheKey = `reports:sales-overview:v4:${companyId}:${salesAudienceKey(actor)}:${zone}:${channel ?? "all"}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cache.get<SalesOverview>(cacheKey);
    if (cached) return cached;

    const monthKey = `${today.key.slice(0, 7)}-01`;
    const previousMonth = new Date(`${monthKey}T12:00:00Z`);
    previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
    const startOfMonth = companyMidnight(monthKey, zone);
    const startOfLastMonth = companyMidnight(
      previousMonth.toISOString().slice(0, 10),
      zone,
    );
    const trendDays = Array.from({ length: 7 }, (_, index) => {
      const key = shiftDateKey(companyDateKey(endDate, zone), index - 6);
      return {
        start: companyMidnight(key, zone),
        end: companyMidnight(shiftDateKey(key, 1), zone),
      };
    });

    const dateWhere: Prisma.SaleWhereInput = {};
    if (startDate || endDate) {
      dateWhere.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const where: Prisma.SaleWhereInput = {
      ...visibility,
      ...dateWhere,
      status: "COMPLETED",
    };
    if (channel) {
      where.channel = channel;
    }

    const channelWhere: Prisma.SaleWhereInput = {
      ...visibility,
      status: "COMPLETED",
    };
    if (channel) {
      channelWhere.channel = channel;
    }

    const [
      totalSales,
      totalRevenue,
      totalCustomers,
      revenueThisMonth,
      revenueLastMonth,
      topProducts,
      recentSales,
      byChannelRaw,
    ] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
      this.prisma.customer.count({ where: { companyId } }),
      this.prisma.sale.aggregate({
        where: { ...channelWhere, createdAt: { gte: startOfMonth, lte: now } },
        _sum: { totalAmount: true },
      }),
      this.prisma.sale.aggregate({
        where: {
          ...channelWhere,
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: where },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      }),
      Promise.all(
        trendDays.map(({ start: dayStart, end: dayEnd }) => {
          return this.prisma.sale.aggregate({
            where: {
              AND: [where, { createdAt: { gte: dayStart, lt: dayEnd } }],
            },
            _count: { id: true },
            _sum: { totalAmount: true },
          });
        }),
      ),
      this.prisma.sale.groupBy({
        by: ["channel"],
        where,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const productIds = topProducts.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const topProductsData = topProducts.slice(0, 8).map((p) => ({
      productId: p.productId,
      name: productMap.get(p.productId) || "Unknown",
      quantity: Number(p._sum.quantity || 0),
      revenue: Number(p._sum.totalPrice || 0),
    }));

    const last7Days: { date: string; sales: number; revenue: number }[] = [];
    for (let index = 0; index < trendDays.length; index++) {
      const dayStart = trendDays[index].start;
      const daySales = recentSales[index];

      last7Days.push({
        date: dayStart.toLocaleDateString("es-PE", {
          weekday: "short",
          day: "numeric",
          timeZone: zone,
        }),
        sales: daySales._count.id,
        revenue: Number(daySales._sum.totalAmount ?? 0),
      });
    }

    const byChannel: SalesByChannel[] = byChannelRaw
      .map((row) => ({
        channel: row.channel,
        sales: row._count.id,
        revenue: Number(row._sum.totalAmount ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const revenueLastMonthVal = Number(revenueLastMonth._sum.totalAmount || 0);
    const revenueThisMonthVal = Number(revenueThisMonth._sum.totalAmount || 0);
    const averageTicket =
      totalSales > 0
        ? Number(totalRevenue._sum.totalAmount || 0) / totalSales
        : 0;

    const result: SalesOverview = {
      totalSales,
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      totalCustomers,
      averageTicket,
      revenueChange:
        revenueLastMonthVal > 0
          ? ((revenueThisMonthVal - revenueLastMonthVal) /
              revenueLastMonthVal) *
            100
          : 0,
      topProducts: topProductsData,
      salesByDay: last7Days,
      byChannel,
      filters: {
        salesScope: canReadCompanySales(actor) ? "COMPANY" : "SELLER",
        channel: channel ?? null,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
      },
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }
}
