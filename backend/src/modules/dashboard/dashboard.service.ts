import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import {
  SalesActor,
  salesAudienceKey,
  salesVisibility,
  canReadCompanySales,
} from "@/common/helpers/sales-visibility.helper";

type GlobalMetrics = {
  currency: string;
  collectedRevenueByCurrency: Record<string, number>;
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  collectedRevenue: number;
};

type SalesAnalytics = {
  daily: Array<{ date: string; sales: number; revenue: number }>;
  weekly: Array<{ week: string; sales: number; revenue: number }>;
  monthly: Array<{ month: string; sales: number; revenue: number }>;
  averageTicket: number;
  totalSales: number;
  totalRevenue: number;
};

type PaymentMethodStats = Array<{
  method: string;
  count: number;
  total: number;
}>;

type TopProduct = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

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
  topCustomers: Array<{
    customerId: string;
    name: string;
    totalPurchases: number;
    totalSpent: number;
  }>;
};

type TenantMetrics = {
  dataCoverage: {
    sales: {
      limit: number;
      returned: number;
      total: number;
      truncated: boolean;
    };
    inventory: {
      limit: number;
      returned: number;
      total: number;
      truncated: boolean;
    };
    topProducts: { source: string; limit: number };
  };
  salesScope: "COMPANY" | "SELLER";
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

type MetricsTrendPoint = {
  bucket: string;
  sales: number;
  revenue: number;
};

type MetricsSummary = {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalUnits: number;
};

type MetricsComparison = {
  revenueChange: number;
  salesChange: number;
  averageTicketChange: number;
};

type RotationPoint = {
  productId: string;
  name: string;
  quantitySold: number;
  averageStock: number;
  rotation: number;
};

type RotationMetrics = {
  globalRotation: number;
  averageStockValue: number;
  coefficient: number;
  products: RotationPoint[];
};

type DashboardMetrics = {
  salesScope: "COMPANY" | "SELLER";
  period: {
    days: number;
    granularity: "day" | "week" | "month";
    from: string;
    to: string;
  };
  summary: MetricsSummary;
  previous: MetricsSummary;
  comparison: MetricsComparison;
  trend: MetricsTrendPoint[];
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  rotation: RotationMetrics;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getGlobalMetrics(): Promise<GlobalMetrics> {
    const cached = await this.cache.get<GlobalMetrics>("dashboard:global:v3");
    if (cached) return cached;

    const [
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      activeSubscriptions,
      succeededPayments,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: "ACTIVE" } }),
      this.prisma.company.count({ where: { status: "SUSPENDED" } }),
      this.prisma.subscription.groupBy({
        by: ["planId", "billingCycle"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ["currency"],
        where: { status: "SUCCEEDED" },
        _sum: { amount: true },
      }),
    ]);

    const plans = await this.prisma.plan.findMany({
      where: {
        id: {
          in: activeSubscriptions.map((subscription) => subscription.planId),
        },
      },
      select: { id: true, priceMonthly: true, priceYearly: true },
    });
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    const monthlyRecurringRevenue = activeSubscriptions.reduce(
      (total, subscription) => {
        const plan = planById.get(subscription.planId);
        return (
          total +
          subscription._count._all *
            (subscription.billingCycle === "YEARLY"
              ? Number(plan?.priceYearly ?? 0) / 12
              : Number(plan?.priceMonthly ?? 0))
        );
      },
      0,
    );
    const annualRecurringRevenue = monthlyRecurringRevenue * 12;
    const collectedRevenueByCurrency = Object.fromEntries(
      succeededPayments.map((payment) => [
        payment.currency,
        Number(payment._sum.amount ?? 0),
      ]),
    );
    const collectedRevenue = collectedRevenueByCurrency.PEN ?? 0;

    const result = {
      currency: "PEN",
      collectedRevenueByCurrency,
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      monthlyRecurringRevenue,
      annualRecurringRevenue,
      collectedRevenue,
    };

    await this.cache.set("dashboard:global:v3", result, 120);
    return result;
  }

  async getTenantMetrics(companyId: string, actor: SalesActor) {
    if (!companyId) {
      return null;
    }

    const visibility = salesVisibility(companyId, actor);
    const cacheKey = `dashboard:tenant:v3:${companyId}:${salesAudienceKey(actor)}`;
    const cached = await this.cache.get<TenantMetrics>(cacheKey);
    if (cached) return cached;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      salesToday,
      recentSales,
      company,
      totalProducts,
      totalCustomers,
      totalEmployees,
      allSales,
      allProducts,
      newThisMonth,
      periodTotals,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          ...visibility,
          status: "COMPLETED",
          createdAt: { gte: todayStart },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.sale.findMany({
        where: { ...visibility, status: "COMPLETED" },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
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
        where: {
          ...visibility,
          status: "COMPLETED",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          createdAt: true,
          totalAmount: true,
          paymentMethod: true,
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      this.prisma.product.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          minStock: true,
          salePrice: true,
        },
        take: 10000,
      }),
      this.prisma.customer.count({
        where: { companyId, createdAt: { gte: monthStart } },
      }),
      this.prisma.sale.aggregate({
        where: {
          ...visibility,
          status: "COMPLETED",
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const salesWithItems = recentSales as unknown as Array<{
      items: Array<{
        productId: string;
        quantity: number;
        product: { name: string };
      }>;
    }>;

    const revenueToday = Number(salesToday._sum.totalAmount ?? 0);
    const topProductMap = new Map<
      string,
      { productId: string; name: string; quantity: number }
    >();

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
    }>;

    const dailyMap = new Map<string, { sales: number; revenue: number }>();
    const weeklyMap = new Map<string, { sales: number; revenue: number }>();
    const monthlyMap = new Map<string, { sales: number; revenue: number }>();
    const paymentMethodMap = new Map<
      string,
      { count: number; total: number }
    >();
    const customerPurchaseMap = new Map<
      string,
      { customerName: string; totalPurchases: number; totalSpent: number }
    >();

    let totalRevenue = 0;

    allSalesData.forEach((sale) => {
      const date = sale.createdAt.toISOString().split("T")[0];
      const month = sale.createdAt.toISOString().slice(0, 7);
      const amount = Number(sale.totalAmount);
      totalRevenue += amount;

      const daily = dailyMap.get(date) ?? { sales: 0, revenue: 0 };
      daily.sales += 1;
      daily.revenue += amount;
      dailyMap.set(date, daily);

      if (sale.createdAt >= sevenDaysAgo) {
        const weekly = weeklyMap.get(date) ?? { sales: 0, revenue: 0 };
        weekly.sales += 1;
        weekly.revenue += amount;
        weeklyMap.set(date, weekly);
      }

      const monthly = monthlyMap.get(month) ?? { sales: 0, revenue: 0 };
      monthly.sales += 1;
      monthly.revenue += amount;
      monthlyMap.set(month, monthly);

      const pm = paymentMethodMap.get(sale.paymentMethod) ?? {
        count: 0,
        total: 0,
      };
      pm.count += 1;
      pm.total += amount;
      paymentMethodMap.set(sale.paymentMethod, pm);

      if (sale.customer) {
        const customerId =
          sale.customer.firstName + " " + sale.customer.lastName;
        const cust = customerPurchaseMap.get(customerId) ?? {
          customerName: customerId,
          totalPurchases: 0,
          totalSpent: 0,
        };
        cust.totalPurchases += 1;
        cust.totalSpent += amount;
        customerPurchaseMap.set(customerId, cust);
      }
    });

    const daily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    const weekly = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({ week, ...data }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const monthly = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const paymentMethods = Array.from(paymentMethodMap.entries())
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.total - a.total);

    const topCustomers = Array.from(customerPurchaseMap.entries())
      .map(([customerId, data]) => ({
        customerId,
        name: data.customerName,
        totalPurchases: data.totalPurchases,
        totalSpent: data.totalSpent,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    const products = allProducts as unknown as Array<{
      id: string;
      name: string;
      stockQuantity: number;
      minStock: number;
      salePrice: unknown;
    }>;

    const totalValue = products.reduce(
      (sum, p) => sum + Number(p.salePrice || 0) * Number(p.stockQuantity),
      0,
    );
    const totalItems = products.reduce(
      (sum, p) => sum + Number(p.stockQuantity),
      0,
    );
    const lowStockCount = products.filter(
      (p) => Number(p.stockQuantity) <= Number(p.minStock),
    ).length;
    const outOfStockCount = products.filter(
      (p) => Number(p.stockQuantity) === 0,
    ).length;
    const slowMovingCount = products.filter(
      (p) => Number(p.stockQuantity) > 50,
    ).length;

    const salesAnalytics = {
      daily,
      weekly,
      monthly,
      averageTicket:
        periodTotals._count.id > 0
          ? Number(periodTotals._sum.totalAmount ?? 0) / periodTotals._count.id
          : 0,
      totalSales: periodTotals._count.id,
      totalRevenue: Number(periodTotals._sum.totalAmount ?? 0),
    };

    const inventoryMetrics: InventoryMetrics = {
      totalValue,
      totalItems,
      lowStockCount,
      outOfStockCount,
      slowMovingCount,
    };

    const customerStats: CustomerStats = {
      total: totalCustomers,
      newThisMonth,
      topCustomers,
    };

    const result = {
      dataCoverage: {
        sales: {
          limit: 500,
          returned: allSalesData.length,
          total: periodTotals._count.id,
          truncated: periodTotals._count.id > allSalesData.length,
        },
        inventory: {
          limit: 10000,
          returned: products.length,
          total: totalProducts,
          truncated: totalProducts > products.length,
        },
        topProducts: { source: "LATEST_COMPLETED_SALES", limit: 25 },
      },
      salesScope: canReadCompanySales(actor)
        ? ("COMPANY" as const)
        : ("SELLER" as const),
      company,
      companyId,
      totalProducts,
      totalCustomers,
      totalEmployees,
      salesToday: salesToday._count.id,
      revenueToday,
      lowStockProducts: lowStockCount,
      topProducts,
      salesAnalytics,
      paymentMethods,
      inventoryMetrics,
      customerStats,
    };

    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getMetrics(
    companyId: string,
    days: number,
    granularity: "day" | "week" | "month",
    actor: SalesActor,
  ): Promise<DashboardMetrics> {
    if (
      !Number.isInteger(days) ||
      days < 1 ||
      days > 366 ||
      !["day", "week", "month"].includes(granularity)
    )
      throw new BadRequestException("Período o granularidad inválidos");
    const visibility = salesVisibility(companyId, actor);
    const cacheKey = `dashboard:metrics:v3:${companyId}:${salesAudienceKey(actor)}:${days}:${granularity}`;
    const cached = await this.cache.get<DashboardMetrics>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);

    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);

    const previousTo = new Date(from);
    previousTo.setMilliseconds(-1);

    const previousFrom = new Date(previousTo);
    previousFrom.setDate(previousFrom.getDate() - (days - 1));
    previousFrom.setHours(0, 0, 0, 0);

    const [currentSales, previousSales] = await Promise.all([
      this.prisma.sale.findMany({
        take: 10001,
        where: {
          ...visibility,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          createdAt: true,
          totalAmount: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              totalPrice: true,
              product: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.sale.findMany({
        take: 10001,
        where: {
          ...visibility,
          status: "COMPLETED",
          createdAt: { gte: previousFrom, lte: previousTo },
        },
        select: { totalAmount: true },
      }),
    ]);
    if (currentSales.length > 10000 || previousSales.length > 10000)
      throw new BadRequestException(
        "El período supera 10000 ventas; consulta un rango menor",
      );

    const current = currentSales as unknown as Array<{
      id: string;
      createdAt: Date;
      totalAmount: unknown;
      items: Array<{
        productId: string;
        quantity: unknown;
        totalPrice: unknown;
        product: { name: string };
      }>;
    }>;
    const previous = previousSales as Array<{ totalAmount: unknown }>;

    const aggregate = (
      sales: Array<{ totalAmount: unknown }>,
      units: number,
    ): MetricsSummary => {
      const revenue = sales.reduce(
        (sum, sale) => sum + Number(sale.totalAmount),
        0,
      );
      return {
        totalSales: sales.length,
        totalRevenue: revenue,
        averageTicket: sales.length > 0 ? revenue / sales.length : 0,
        totalUnits: units,
      };
    };

    let totalUnits = 0;
    const trendMap = new Map<string, MetricsTrendPoint>();
    const productMap = new Map<
      string,
      { productId: string; name: string; quantity: number; revenue: number }
    >();

    const bucketKey = (date: Date): string => {
      const iso = date.toISOString().split("T")[0];
      if (granularity === "day") return iso;
      if (granularity === "month") return iso.slice(0, 7);
      const monday = new Date(date);
      const dayIdx = (monday.getUTCDay() + 6) % 7;
      monday.setUTCDate(monday.getUTCDate() - dayIdx);
      return monday.toISOString().split("T")[0];
    };

    for (const sale of current) {
      const amount = Number(sale.totalAmount);
      const key = bucketKey(sale.createdAt);
      const point = trendMap.get(key) ?? { bucket: key, sales: 0, revenue: 0 };
      point.sales += 1;
      point.revenue += amount;
      trendMap.set(key, point);

      for (const item of sale.items) {
        const quantity = Number(item.quantity);
        const lineRevenue = Number(item.totalPrice);
        totalUnits += quantity;
        const entry = productMap.get(item.productId) ?? {
          productId: item.productId,
          name: item.product.name,
          quantity: 0,
          revenue: 0,
        };
        entry.quantity += quantity;
        entry.revenue += lineRevenue;
        productMap.set(item.productId, entry);
      }
    }

    const summary = aggregate(current, totalUnits);
    const previousSummary = aggregate(previous, 0);

    const percentChange = (currentValue: number, previousValue: number) => {
      if (previousValue === 0) {
        return currentValue > 0 ? 100 : 0;
      }
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    const comparison: MetricsComparison = {
      revenueChange: percentChange(
        summary.totalRevenue,
        previousSummary.totalRevenue,
      ),
      salesChange: percentChange(
        summary.totalSales,
        previousSummary.totalSales,
      ),
      averageTicketChange: percentChange(
        summary.averageTicket,
        previousSummary.averageTicket,
      ),
    };

    const trend = Array.from(trendMap.values()).sort((a, b) =>
      a.bucket.localeCompare(b.bucket),
    );

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topIds = topProducts.map((p) => p.productId);
    const stockRows =
      topIds.length > 0
        ? await this.prisma.product.findMany({
            where: { companyId, id: { in: topIds } },
            select: { id: true, stockQuantity: true },
          })
        : [];
    const stockById = new Map(
      stockRows.map((row) => [row.id, Number(row.stockQuantity)]),
    );

    const rotationProducts: RotationPoint[] = topProducts.map((product) => {
      const averageStock = stockById.get(product.productId) ?? 0;
      const rotation =
        averageStock > 0 ? product.quantity / averageStock : product.quantity;
      return {
        productId: product.productId,
        name: product.name,
        quantitySold: product.quantity,
        averageStock,
        rotation,
      };
    });

    const averageStockValue =
      rotationProducts.length > 0
        ? rotationProducts.reduce((sum, p) => sum + p.averageStock, 0) /
          rotationProducts.length
        : 0;
    const averageUnits =
      rotationProducts.length > 0
        ? rotationProducts.reduce((sum, p) => sum + p.quantitySold, 0) /
          rotationProducts.length
        : 0;
    const globalRotation =
      averageStockValue > 0 ? averageUnits / averageStockValue : 0;

    const rotation: RotationMetrics = {
      globalRotation,
      averageStockValue,
      coefficient: globalRotation,
      products: rotationProducts.sort((a, b) => b.rotation - a.rotation),
    };

    const result: DashboardMetrics = {
      salesScope: canReadCompanySales(actor) ? "COMPANY" : "SELLER",
      period: {
        days,
        granularity,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary,
      previous: previousSummary,
      comparison,
      trend,
      topProducts,
      rotation,
    };

    await this.cache.set(cacheKey, result, 60);
    return result;
  }
}
