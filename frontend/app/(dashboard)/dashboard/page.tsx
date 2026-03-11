import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { Building2, CreditCard, DollarSign, Users, Activity, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Package, ShoppingCart } from 'lucide-react';

type GlobalMetrics = {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  collectedRevenue: number;
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
    isSuperAdmin ? serverApiFetch<Subscription[]>('/subscriptions', accessToken) : Promise.resolve(null),
    !isSuperAdmin ? serverApiFetch<TenantMetrics>('/dashboard/tenant', accessToken) : Promise.resolve(null),
  ]);

  const stats = isSuperAdmin
    ? [
        { label: 'Empresas', value: globalMetrics?.totalCompanies ?? 0, icon: Building2, color: 'blue', delta: 'total registradas' },
        { label: 'Activas', value: globalMetrics?.activeCompanies ?? 0, icon: CheckCircle, color: 'green', delta: 'operativas' },
        { label: 'MRR', value: `$${(globalMetrics?.monthlyRecurringRevenue ?? 0).toFixed(0)}`, icon: DollarSign, color: 'violet', delta: 'mensual' },
        { label: 'Cobrado', value: `$${(globalMetrics?.collectedRevenue ?? 0).toFixed(0)}`, icon: CreditCard, color: 'emerald', delta: 'total' },
      ]
    : [
        { label: 'Ventas hoy', value: tenantMetrics?.salesToday ?? 0, icon: ShoppingCart, color: 'violet', delta: 'transacciones' },
        { label: 'Ingresos hoy', value: `$${(tenantMetrics?.revenueToday ?? 0).toFixed(2)}`, icon: DollarSign, color: 'green', delta: 'hoy' },
        { label: 'Stock bajo', value: tenantMetrics?.lowStockProducts ?? 0, icon: AlertCircle, color: 'amber', delta: 'productos' },
        { label: 'Productos', value: tenantMetrics?.totalProducts ?? 0, icon: Package, color: 'blue', delta: 'total' },
      ];

  const iconColors: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-600',
    green: 'bg-green-500/20 text-green-600',
    violet: 'bg-violet-500/20 text-violet-600',
    emerald: 'bg-emerald-500/20 text-emerald-600',
    amber: 'bg-amber-500/20 text-amber-600',
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[34px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-white/50">Panel de control</p>
              <h1 className="mt-4 font-display text-5xl leading-none">
                Consola {isSuperAdmin ? 'Super Admin' : 'Operativa'}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                {isSuperAdmin
                  ? 'Gestiona empresas, monitoreo de ingresos y actividad de la plataforma SaaS.'
                  : `Bienvenido a ${tenantMetrics?.company?.name || 'tu empresa'}. Consulta tus métricas y operaciones.`}
              </p>
            </div>
            {isSuperAdmin && (
              <div className="hidden xl:block">
                <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
                  <p className="text-sm uppercase tracking-[0.18em] text-white/60">Estado</p>
                  <p className="mt-2 font-display text-3xl text-green-400">Operativo</p>
                  <p className="mt-1 text-sm text-white/50">Todos los servicios activos</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-[34px] bg-white/85 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            {isSuperAdmin ? 'Actividad reciente' : 'Resumen'}
          </p>
          <div className="mt-5 space-y-4">
            {isSuperAdmin && auditLogs ? (
              auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-xl bg-foreground/[0.02] p-3">
                  <div className="mt-1 rounded-lg bg-slate-100 p-1.5">
                    <Activity className="size-4 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-foreground/50">
                      {log.company?.name || log.entity} · {new Date(log.createdAt).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                </div>
              ))
            ) : !isSuperAdmin && tenantMetrics ? (
              <>
                <div className="flex items-center justify-between rounded-xl bg-violet-50 p-4">
                  <div className="flex items-center gap-3">
                    <Users className="size-5 text-violet-600" />
                    <span className="font-medium">Clientes</span>
                  </div>
                  <span className="font-display text-xl text-violet-700">{tenantMetrics.totalCustomers}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <Users className="size-5 text-emerald-600" />
                    <span className="font-medium">Empleados</span>
                  </div>
                  <span className="font-display text-xl text-emerald-700">{tenantMetrics.totalEmployees}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4">
                  <div className="flex items-center gap-3">
                    <Package className="size-5 text-amber-600" />
                    <span className="font-medium">Productos</span>
                  </div>
                  <span className="font-display text-xl text-amber-700">{tenantMetrics.totalProducts}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground/50">No hay datos disponibles</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="rounded-[30px] bg-white/80 p-6">
              <div className="flex items-center justify-between">
                <div className={`rounded-2xl p-2.5 ${iconColors[stat.color]}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs text-foreground/40">{stat.delta}</span>
              </div>
              <p className="mt-4 font-display text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-foreground/50">{stat.label}</p>
            </Card>
          );
        })}
      </div>

      {isSuperAdmin && (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[34px] bg-white/85 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ingresos</p>
                <h2 className="mt-2 font-display text-2xl">Revenue Overview</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-600">
                <TrendingUp className="size-4" />
                +12.5%
              </div>
            </div>
            <RevenueChart />
          </Card>

          <Card className="rounded-[34px] bg-white/85 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Suscripciones</p>
            <div className="mt-5 space-y-4">
              {recentSubscriptions?.slice(0, 5).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-xl border border-foreground/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${sub.status === 'ACTIVE' ? 'bg-green-100' : 'bg-amber-100'}`}>
                      <CreditCard className={`size-4 ${sub.status === 'ACTIVE' ? 'text-green-600' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{sub.company?.name || 'Empresa'}</p>
                      <p className="text-xs text-foreground/50">{sub.plan?.name} · {sub.provider}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${sub.status === 'ACTIVE' ? 'border-green-500/30 bg-green-500/20 text-green-700' : 'border-amber-500/30 bg-amber-500/20 text-amber-700'}`}>
                    {sub.status}
                  </span>
                </div>
              ))}
              {(!recentSubscriptions || recentSubscriptions.length === 0) && (
                <p className="text-center text-sm text-foreground/50">No hay suscripciones</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {isSuperAdmin && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="rounded-[34px] bg-white/85 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Empresas</p>
                <h2 className="mt-2 font-display text-2xl">Estado de empresas</h2>
              </div>
              <a href="/companies" className="text-sm text-violet-600 hover:underline">
                Ver todas →
              </a>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="size-5 text-green-600" />
                  <span className="font-medium">Activas</span>
                </div>
                <span className="font-display text-xl text-green-700">{globalMetrics?.activeCompanies ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="size-5 text-amber-600" />
                  <span className="font-medium">Suspendidas</span>
                </div>
                <span className="font-display text-xl text-amber-700">{globalMetrics?.suspendedCompanies ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 text-slate-600" />
                  <span className="font-medium">Total</span>
                </div>
                <span className="font-display text-xl text-slate-700">{globalMetrics?.totalCompanies ?? 0}</span>
              </div>
            </div>
          </Card>

          <Card className="rounded-[34px] bg-white/85 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Finanzas</p>
                <h2 className="mt-2 font-display text-2xl">Métricas financieras</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-foreground/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground/50">MRR (Monthly Recurring Revenue)</p>
                  <TrendingUp className="size-4 text-green-600" />
                </div>
                <p className="mt-2 font-display text-3xl">${(globalMetrics?.monthlyRecurringRevenue ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-foreground/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground/50">ARR (Annual Recurring Revenue)</p>
                  <TrendingUp className="size-4 text-green-600" />
                </div>
                <p className="mt-2 font-display text-3xl">${(globalMetrics?.annualRecurringRevenue ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-foreground/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground/50">Total Cobrado</p>
                  <DollarSign className="size-4 text-violet-600" />
                </div>
                <p className="mt-2 font-display text-3xl">${(globalMetrics?.collectedRevenue ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
