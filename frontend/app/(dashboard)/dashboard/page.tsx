import { auth } from '@/auth';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type GlobalMetrics = {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  collectedRevenue: number;
};

type TenantMetrics = {
  company?: {
    id: string;
    name: string;
    status: string;
    currency: string;
  } | null;
  salesToday: number;
  revenueToday: number;
  lowStockProducts: number;
  topProducts: Array<{ productId: string; name: string; quantity: number }>;
};

type Sale = {
  id: string;
  saleNumber: string;
  totalAmount: string;
  paymentMethod: string;
  createdAt: string;
};

export default async function DashboardPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const accessToken = session?.accessToken;
  const isGlobalRole = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');

  const [globalMetrics, tenantMetrics, recentSales] = await Promise.all([
    isGlobalRole ? serverApiFetch<GlobalMetrics>('/dashboard/global', accessToken) : Promise.resolve(null),
    !isGlobalRole ? serverApiFetch<TenantMetrics>('/dashboard/tenant', accessToken) : Promise.resolve(null),
    !isGlobalRole ? serverApiFetch<Sale[]>('/sales', accessToken) : Promise.resolve(null),
  ]);

  const stats = isGlobalRole
    ? [
        ['Empresas', `${globalMetrics?.totalCompanies ?? 0}`, 'tenants registrados'],
        ['Activas', `${globalMetrics?.activeCompanies ?? 0}`, 'cuentas operativas'],
        ['MRR', `$${globalMetrics?.monthlyRecurringRevenue ?? 0}`, 'ingreso recurrente mensual'],
        ['Cobrado', `$${globalMetrics?.collectedRevenue ?? 0}`, 'pagos confirmados'],
      ]
    : [
        ['Ventas hoy', `${tenantMetrics?.salesToday ?? 0}`, 'tickets emitidos'],
        ['Ingresos hoy', `S/ ${tenantMetrics?.revenueToday ?? 0}`, 'ventas del dia'],
        ['Stock critico', `${tenantMetrics?.lowStockProducts ?? 0}`, 'productos bajo minimo'],
        ['Empresa', tenantMetrics?.company?.name ?? 'Sin datos', tenantMetrics?.company?.status ?? 'pending'],
      ];

  const topProducts = tenantMetrics?.topProducts?.length
    ? tenantMetrics.topProducts.map((product) => [product.name, `${product.quantity} unidades`] as const)
    : ([['Sin datos', 'Corre el seed para ver resultados']] as const);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[34px] bg-foreground p-8 text-white">
          <p className="text-sm uppercase tracking-[0.18em] text-white/50">Vista operativa</p>
          <h1 className="mt-4 font-display text-5xl leading-none">
            {isGlobalRole ? 'Panel SaaS global para administracion central.' : 'Panel operativo del tenant.'}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            {isGlobalRole
              ? 'Monitorea ingresos recurrentes, empresas activas, pagos y operacion del proveedor SaaS.'
              : 'Consulta ventas, inventario, senales de operacion y productos mas demandados por la empresa.'}
          </p>
        </Card>
        <Card className="rounded-[34px] bg-white/85 p-8">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/55">Cola de atencion</p>
          <ul className="mt-5 space-y-4 text-sm text-foreground/68">
            {isGlobalRole ? (
              <>
                <li>{globalMetrics?.activeCompanies ?? 0} empresas activas.</li>
                <li>{globalMetrics?.suspendedCompanies ?? 0} empresas suspendidas.</li>
                <li>${globalMetrics?.annualRecurringRevenue ?? 0} ARR estimado.</li>
                <li>Listo para activar checkout y webhooks.</li>
              </>
            ) : (
              <>
                <li>{tenantMetrics?.lowStockProducts ?? 0} productos bajo stock minimo.</li>
                <li>{recentSales?.length ?? 0} ventas recientes disponibles.</li>
                <li>{tenantMetrics?.topProducts?.length ?? 0} productos con senal de demanda.</li>
                <li>Listo para seguir con POS y CRUDs operativos.</li>
              </>
            )}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, delta]) => (
          <Card key={label} className="rounded-[30px] bg-white/80 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">{label}</p>
            <p className="mt-4 font-display text-4xl">{value}</p>
            <p className="mt-2 text-sm text-accent">{delta}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[34px] bg-white/85 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Revenue signal</p>
              <h2 className="mt-2 font-display text-3xl">Ingresos y ventas semanales</h2>
            </div>
          </div>
          <RevenueChart />
        </Card>
        <Card className="rounded-[34px] bg-white/85 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Top productos</p>
          <div className="mt-5 space-y-4">
            {topProducts.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between rounded-2xl border border-foreground/10 px-4 py-3">
                <span className="font-medium">{name}</span>
                <span className="text-sm text-foreground/55">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {!isGlobalRole ? (
        <Card className="rounded-[34px] bg-white/85 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ventas recientes</p>
          <div className="mt-5 grid gap-3">
            {(recentSales?.length ? recentSales : []).slice(0, 6).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-2xl border border-foreground/10 px-4 py-3">
                <div>
                  <p className="font-medium">{sale.saleNumber}</p>
                  <p className="text-sm text-foreground/55">{sale.paymentMethod}</p>
                </div>
                <span className="text-sm text-foreground/70">S/ {sale.totalAmount}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
