import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';

type SalesAnalytics = {
  daily: Array<{ date: string; sales: number; revenue: number }>;
  weekly: Array<{ week: string; sales: number; revenue: number }>;
  monthly: Array<{ month: string; sales: number; revenue: number }>;
  averageTicket: number;
  totalSales: number;
  totalRevenue: number;
};

type PaymentMethodStats = Array<{ method: string; count: number; total: number }>;

type TopProduct = { productId: string; name: string; quantity: number; revenue: number };

type InventoryMetrics = {
  totalValue: number;
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  slowMovingCount: number;
};

type CustomerStats = {
  total: number;
  newThisMonth: number;
  topCustomers: Array<{ customerId: string; name: string; totalPurchases: number; totalSpent: number }>;
};

type TenantMetrics = {
  company: { name: string; status: string; currency: string } | null;
  companyId: string;
  totalProducts: number;
  totalCustomers: number;
  totalEmployees: number;
  salesToday: number;
  revenueToday: number;
  lowStockProducts: number;
  topProducts: Array<{ productId: string; name: string; quantity: number }>;
  salesAnalytics: SalesAnalytics;
  paymentMethods: PaymentMethodStats;
  inventoryMetrics: InventoryMetrics;
  customerStats: CustomerStats;
};

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

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      salesToday,
      lowStockProducts,
      recentSales,
      company,
      totalProducts,
      totalCustomers,
      totalEmployees,
      allSales,
      allProducts,
      allCustomers,
    ] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          companyId,
          createdAt: { gte: todayStart },
        },
        include: { items: true },
      }),
      this.prisma.product.count({
        where: {
          companyId,
          stockQuantity: { lte: 10 },
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
      this.prisma.sale.findMany({
        where: { companyId, createdAt: { gte: thirtyDaysAgo } },
        include: { items: { include: { product: true } }, customer: true },
      }),
      this.prisma.product.findMany({
        where: { companyId },
        select: { id: true, name: true, stockQuantity: true, costPrice: true, salePrice: true },
      }),
      this.prisma.customer.findMany({
        where: { companyId },
        include: { sales: { select: { id: true, totalAmount: true } } },
      }),
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

    const allSalesData = allSales as Array<{
      id: string;
      createdAt: Date;
      totalAmount: unknown;
      customer: { firstName: string; lastName: string } | null;
      paymentMethod: string;
      items: Array<{ productId: string; quantity: number; product: { name: string; salePrice: unknown } }>;
    }>;

    const dailyMap = new Map<string, { sales: number; revenue: number }>();
    const monthlyMap = new Map<string, { sales: number; revenue: number }>();
    const paymentMethodMap = new Map<string, { count: number; total: number }>();
    const customerPurchaseMap = new Map<string, { customerName: string; totalPurchases: number; totalSpent: number }>();

    let totalRevenue = 0;

    allSalesData.forEach((sale) => {
      const date = sale.createdAt.toISOString().split('T')[0];
      const month = sale.createdAt.toISOString().slice(0, 7);
      const amount = Number(sale.totalAmount);
      totalRevenue += amount;

      const daily = dailyMap.get(date) ?? { sales: 0, revenue: 0 };
      daily.sales += 1;
      daily.revenue += amount;
      dailyMap.set(date, daily);

      const monthly = monthlyMap.get(month) ?? { sales: 0, revenue: 0 };
      monthly.sales += 1;
      monthly.revenue += amount;
      monthlyMap.set(month, monthly);

      const pm = paymentMethodMap.get(sale.paymentMethod) ?? { count: 0, total: 0 };
      pm.count += 1;
      pm.total += amount;
      paymentMethodMap.set(sale.paymentMethod, pm);

      if (sale.customer) {
        const customerId = sale.customer.firstName + ' ' + sale.customer.lastName;
        const cust = customerPurchaseMap.get(customerId) ?? { customerName: customerId, totalPurchases: 0, totalSpent: 0 };
        cust.totalPurchases += 1;
        cust.totalSpent += amount;
        customerPurchaseMap.set(customerId, cust);
      }
    });

    const daily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    const monthly = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const paymentMethods = Array.from(paymentMethodMap.entries())
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.total - a.total);

    const topCustomers = Array.from(customerPurchaseMap.entries())
      .map(([customerId, data]) => ({ customerId, name: data.customerName, totalPurchases: data.totalPurchases, totalSpent: data.totalSpent }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    const products = allProducts as Array<{
      id: string;
      name: string;
      stockQuantity: number;
      costPrice: unknown;
      salePrice: unknown;
    }>;

    const totalValue = products.reduce((sum, p) => sum + Number(p.salePrice || 0) * p.stockQuantity, 0);
    const totalItems = products.reduce((sum, p) => sum + p.stockQuantity, 0);
    const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;
    const slowMovingCount = products.filter((p) => p.stockQuantity > 50).length;

    const customersData = allCustomers as Array<{
      id: string;
      firstName: string;
      lastName: string;
      createdAt: Date;
    }>;

    const newThisMonth = customersData.filter((c) => new Date(c.createdAt) >= monthStart).length;

    const salesAnalytics = {
      daily,
      weekly: [],
      monthly,
      averageTicket: allSalesData.length > 0 ? totalRevenue / allSalesData.length : 0,
      totalSales: allSalesData.length,
      totalRevenue,
    };

    const inventoryMetrics: InventoryMetrics = {
      totalValue,
      totalItems,
      lowStockCount: lowStockProducts,
      outOfStockCount,
      slowMovingCount,
    };

    const customerStats: CustomerStats = {
      total: totalCustomers,
      newThisMonth,
      topCustomers,
    };

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
      salesAnalytics,
      paymentMethods,
      inventoryMetrics,
      customerStats,
    };
  }
}
