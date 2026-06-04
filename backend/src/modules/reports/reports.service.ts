import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CacheService } from '@/cache/cache.service';

type SalesOverview = {
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  averageTicket: number;
  revenueChange: number;
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  salesByDay: Array<{ date: string; sales: number; revenue: number }>;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSalesOverview(companyId: string): Promise<SalesOverview> {
    const cacheKey = `reports:sales-overview:${companyId}`;
    const cached = await this.cache.get<SalesOverview>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalSales,
      totalRevenue,
      totalCustomers,
      revenueThisMonth,
      revenueLastMonth,
      topProducts,
      recentSales,
    ] = await Promise.all([
      this.prisma.sale.count({ where: { companyId } }),
      this.prisma.sale.aggregate({
        where: { companyId },
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
        by: ['productId'],
        where: { sale: { companyId } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      this.prisma.sale.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, createdAt: true, totalAmount: true },
      }),
    ]);

    const revenueThisMonthVal = Number(revenueThisMonth._sum.totalAmount || 0);
    const revenueLastMonthVal = Number(revenueLastMonth._sum.totalAmount || 0);

    const productIds = topProducts.map(p => p.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map(p => [p.id, p.name]));

    const topProductsData = topProducts.map(p => ({
      productId: p.productId,
      name: productMap.get(p.productId) || 'Unknown',
      quantity: p._sum.quantity || 0,
      revenue: Number(p._sum.totalPrice || 0),
    }));

    const last7Days: { date: string; sales: number; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySales = recentSales.filter(
        s => s.createdAt >= dayStart && s.createdAt < dayEnd
      );

      last7Days.push({
        date: dayStart.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' }),
        sales: daySales.length,
        revenue: daySales.reduce((acc, s) => acc + Number(s.totalAmount), 0),
      });
    }

    const averageTicket = totalSales > 0 ? Number(totalRevenue._sum.totalAmount || 0) / totalSales : 0;

    const result = {
      totalSales,
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      totalCustomers,
      averageTicket,
      revenueChange: revenueLastMonthVal > 0 
        ? ((revenueThisMonthVal - revenueLastMonthVal) / revenueLastMonthVal) * 100 
        : 0,
      topProducts: topProductsData,
      salesByDay: last7Days,
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }
}
