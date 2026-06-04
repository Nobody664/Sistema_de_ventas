import { getServerSession } from '@/lib/session';
import { serverApiFetch } from '@/lib/server-api';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Suspense } from 'react';

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

async function DashboardDataLoader() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;
  const userRoles = session?.user?.roles ?? [];
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPPORT_ADMIN');

  let globalMetrics: GlobalMetrics | null = null;
  let auditLogs: AuditLog[] | null = null;
  let recentSubscriptions: Subscription[] | null = null;

  const [tenantMetrics] = await Promise.all([
    serverApiFetch<TenantMetrics | null>('/dashboard/tenant', accessToken ?? undefined),
  ]);

  if (isSuperAdmin) {
    [globalMetrics, auditLogs, recentSubscriptions] = await Promise.all([
      serverApiFetch<GlobalMetrics | null>('/dashboard/global', accessToken ?? undefined),
      serverApiFetch<AuditLog[] | null>('/audit/global', accessToken ?? undefined),
      serverApiFetch<Subscription[] | null>('/subscriptions/subscribers', accessToken ?? undefined),
    ]);
  }

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

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="h-48 rounded-[34px] bg-gray-200" />
        <div className="h-48 rounded-[34px] bg-gray-100" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-[30px] bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardDataLoader />
    </Suspense>
  );
}
