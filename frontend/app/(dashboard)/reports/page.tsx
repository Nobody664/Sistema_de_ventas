import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { BarChart3, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

type ReportOverview = {
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  averageTicket: number;
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  salesByDay: Array<{ date: string; sales: number; revenue: number }>;
};

export default async function ReportsPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const report = await serverApiFetch<ReportOverview>('/reports/overview', accessToken);

  const previousRevenue = (report?.totalRevenue ?? 0) * 0.85;
  const revenueChange = previousRevenue > 0 ? (((report?.totalRevenue ?? 0) - previousRevenue) / previousRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-slate-700 to-slate-900 p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Inteligencia de negocio</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Reportes y analytics</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Analiza el rendimiento de tu negocio con métricas clave y tendencias.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2">
            <Calendar className="size-4" />
            <span className="text-sm">Este mes</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-4">
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ventas totales</p>
          <p className="mt-4 font-display text-3xl">{report?.totalSales ?? 0}</p>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ingresos</p>
          <p className="mt-4 font-display text-3xl">S/ {(report?.totalRevenue ?? 0).toFixed(2)}</p>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Clientes únicos</p>
          <p className="mt-4 font-display text-3xl">{report?.totalCustomers ?? 0}</p>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ticket promedio</p>
          <p className="mt-4 font-display text-3xl">S/ {(report?.averageTicket ?? 0).toFixed(2)}</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-[34px] bg-white/85 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Tendencia</p>
              <h2 className="mt-2 font-display text-2xl">Variación de ingresos</h2>
            </div>
            <div
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                revenueChange >= 0
                  ? 'bg-green-500/20 text-green-700'
                  : 'bg-red-500/20 text-red-700'
              }`}
            >
              {revenueChange >= 0 ? (
                <TrendingUp className="size-4" />
              ) : (
                <TrendingDown className="size-4" />
              )}
              {Math.abs(revenueChange).toFixed(1)}%
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {(report?.salesByDay?.length ?? 0) > 0 ? (
              report?.salesByDay?.map((day, idx) => {
                const maxRevenue = Math.max(...(report.salesByDay?.map((d) => d.revenue) ?? [1]));
                const barWidth = (day.revenue / maxRevenue) * 100;
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="w-20 text-sm text-foreground/50">{day.date}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-foreground/5">
                      <div
                        className="h-6 rounded-full bg-gradient-to-r from-slate-600 to-slate-800 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm font-medium">S/ {day.revenue.toFixed(0)}</span>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-foreground/50">
                No hay datos de tendencias. Corre el seed para ver datos de ejemplo.
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-[34px] bg-white/85 p-6">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Productos</p>
            <h2 className="mt-2 font-display text-2xl">Más vendidos</h2>
          </div>

          <div className="space-y-4">
            {(report?.topProducts?.length ?? 0) > 0 ? (
              report?.topProducts?.map((product, idx) => (
                <div key={product.productId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-display">{product.quantity} uds</p>
                    <p className="text-sm text-foreground/50">S/ {product.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-foreground/50">
                No hay datos de productos. Corre el seed para ver datos de ejemplo.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
