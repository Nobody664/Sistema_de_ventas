import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalMetrics() {
    const [totalCompanies, activeCompanies, suspendedCompanies, activeSubscriptions, succeededPayments] =
      await Promise.all([
        this.prisma.company.count(),
        this.prisma.company.count({ where: { status: 'ACTIVE' } }),
        this.prisma.company.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.subscription.findMany({
          where: { status: 'ACTIVE' },
          include: { plan: true },
        }),
        this.prisma.payment.findMany({
          where: { status: 'SUCCEEDED' },
        }),
      ]);

    const subscriptions = activeSubscriptions as Array<{
      plan: { priceMonthly: unknown; priceYearly: unknown };
    }>;
    const payments = succeededPayments as Array<{ amount: unknown }>;

    const monthlyRecurringRevenue = subscriptions.reduce(
      (total: number, subscription) => total + Number(subscription.plan.priceMonthly),
      0,
    );
    const annualRecurringRevenue = subscriptions.reduce(
      (total: number, subscription) => total + Number(subscription.plan.priceYearly),
      0,
    );
    const collectedRevenue = payments.reduce((total: number, payment) => total + Number(payment.amount), 0);

    return {
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      monthlyRecurringRevenue,
      annualRecurringRevenue,
      collectedRevenue,
    };
  }

  async getTenantMetrics(companyId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      salesToday,
      lowStockProducts,
      recentSales,
      company,
      totalProducts,
      totalCustomers,
      totalEmployees,
    ] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          companyId,
          createdAt: {
            gte: todayStart,
          },
        },
        include: { items: true },
      }),
      this.prisma.product.count({
        where: {
          companyId,
          stockQuantity: {
            lte: 10,
          },
        },
      }),
      this.prisma.sale.findMany({
        where: { companyId },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, status: true, currency: true },
      }),
      this.prisma.product.count({ where: { companyId } }),
      this.prisma.customer.count({ where: { companyId } }),
      this.prisma.employee.count({ where: { companyId } }),
    ]);

    const todaySales = salesToday as Array<{ totalAmount: unknown }>;
    const salesWithItems = recentSales as Array<{
      items: Array<{ productId: string; quantity: number; product: { name: string } }>;
    }>;

    const revenueToday = todaySales.reduce((total: number, sale) => total + Number(sale.totalAmount), 0);
    const topProductMap = new Map<string, { productId: string; name: string; quantity: number }>();

    salesWithItems.forEach((sale) => {
      sale.items.forEach((item) => {
        const current = topProductMap.get(item.productId) ?? {
          productId: item.productId,
          name: item.product.name,
          quantity: 0,
        };

        current.quantity += item.quantity;
        topProductMap.set(item.productId, current);
      });
    });

    const topProducts = Array.from(topProductMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      company,
      companyId,
      totalProducts,
      totalCustomers,
      totalEmployees,
      salesToday: salesToday.length,
      revenueToday,
      lowStockProducts,
      topProducts,
    };
  }
}
