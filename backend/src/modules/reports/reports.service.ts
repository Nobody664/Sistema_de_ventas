import { Injectable } from "@nestjs/common";
import { Prisma, SaleChannel } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import { ReportsOverviewQueryDto } from "./dto/reports-query.dto";

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
  ): Promise<SalesOverview> {
    const channel = query.channel;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    const cacheKey = `reports:sales-overview:${companyId}:${channel ?? "all"}:${startDate?.toISOString() ?? ""}:${endDate?.toISOString() ?? ""}`;
    const cached = await this.cache.get<SalesOverview>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const dateWhere: Prisma.SaleWhereInput = {};
    if (startDate || endDate) {
      dateWhere.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const where: Prisma.SaleWhereInput = { companyId, ...dateWhere };
    if (channel) {
      where.channel = channel;
    }

    const channelWhere: Prisma.SaleWhereInput = { companyId };
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
        where: { companyId, createdAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      this.prisma.sale.aggregate({
        where: {
          companyId,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: where },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
      }),
      this.prisma.sale.findMany({
        where: channelWhere,
        select: { createdAt: true, totalAmount: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      this.prisma.sale.groupBy({
        by: ["channel"],
        where: { companyId, ...dateWhere },
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

    const trendEnd = endDate ?? now;
    const last7Days: { date: string; sales: number; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(trendEnd);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySales = recentSales.filter(
        (s) => s.createdAt >= dayStart && s.createdAt < dayEnd,
      );

      last7Days.push({
        date: dayStart.toLocaleDateString("es-PE", {
          weekday: "short",
          day: "numeric",
        }),
        sales: daySales.length,
        revenue: daySales.reduce((acc, s) => acc + Number(s.totalAmount), 0),
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
        channel: channel ?? null,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
      },
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }
}
