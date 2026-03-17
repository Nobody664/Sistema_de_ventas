import { auth } from '@/auth';
import { serverApiFetch } from '@/lib/server-api';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

type GlobalMetrics = {
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

type PaymentMethodStats = Array<{ method: string; count: number; total: number }>;

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

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: { email: string; fullName: string };
  company?: { name: string };
};

type Subscription = {
  id: string;
  status: string;
  provider: string;
  billingCycle: string;
  plan?: { name: string; priceMonthly: string };
  company?: { name: string };
};

export default async function DashboardPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const accessToken = session?.accessToken;
  const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');

  const [globalMetrics, auditLogs, recentSubscriptions, tenantMetrics] = await Promise.all([
    isSuperAdmin ? serverApiFetch<GlobalMetrics>('/dashboard/global', accessToken) : Promise.resolve(null),
    isSuperAdmin ? serverApiFetch<AuditLog[]>('/audit/global', accessToken) : Promise.resolve(null),
    isSuperAdmin ? serverApiFetch<Subscription[]>('/subscriptions/subscribers', accessToken) : Promise.resolve(null),
    !isSuperAdmin ? serverApiFetch<TenantMetrics>('/dashboard/tenant', accessToken) : Promise.resolve(null),
  ]);

  return (
    <DashboardClient
      globalMetrics={globalMetrics}
      auditLogs={auditLogs}
      recentSubscriptions={recentSubscriptions}
      tenantMetrics={tenantMetrics}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
