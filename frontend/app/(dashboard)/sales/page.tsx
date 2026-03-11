import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { ShoppingCart, DollarSign, CreditCard, Banknote, TrendingUp, Calendar } from 'lucide-react';
import { NewSaleModal } from '@/components/sales/new-sale-modal';
import type { Product, Customer, Sale } from '@/types/api';

export default async function SalesPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const [sales, products, customers] = await Promise.all([
    serverApiFetch<Sale[]>('/sales', accessToken),
    serverApiFetch<Product[]>('/products', accessToken),
    serverApiFetch<Customer[]>('/customers', accessToken),
  ]);

  const totalRevenue = sales?.reduce((acc, s) => acc + Number(s.totalAmount), 0) ?? 0;
  const totalSales = sales?.length ?? 0;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const salesToday = sales?.filter(s => new Date(s.paidAt) >= today).length ?? 0;
  const revenueToday = sales?.filter(s => new Date(s.paidAt) >= today).reduce((acc, s) => acc + Number(s.totalAmount), 0) ?? 0;

  const paymentMethods: Record<string, { icon: typeof CreditCard; label: string }> = {
    CASH: { icon: Banknote, label: 'Efectivo' },
    CARD: { icon: CreditCard, label: 'Tarjeta' },
    TRANSFER: { icon: DollarSign, label: 'Transferencia' },
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-rose-600 p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Punto de venta</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Gestión de ventas</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Registra nuevas ventas, consulta el historial y gestiona transacciones.
            </p>
          </div>
          <NewSaleModal products={products ?? []} customers={customers ?? []} />
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-500/20 p-2">
              <ShoppingCart className="size-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ventas hoy</p>
              <p className="font-display text-3xl">{salesToday}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-green-500/20 p-2">
              <DollarSign className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ingresos hoy</p>
              <p className="font-display text-3xl">S/ {revenueToday.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <TrendingUp className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total ventas</p>
              <p className="font-display text-3xl">{totalSales}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/20 p-2">
              <CreditCard className="size-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Ticket promedio</p>
              <p className="font-display text-3xl">S/ {avgTicket.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Historial</p>
            <h2 className="mt-2 font-display text-2xl">Ventas recientes</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground/50">
            <Calendar className="size-4" />
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        <div className="space-y-3">
          {(sales?.length ?? 0) > 0 ? (
            sales?.slice(0, 15).map((sale) => {
              const PaymentIcon = paymentMethods[sale.paymentMethod]?.icon || DollarSign;
              const isToday = new Date(sale.paidAt) >= today;
              return (
                <div
                  key={sale.id}
                  className={`flex items-center justify-between rounded-2xl border p-4 transition hover:border-orange-500/30 ${
                    isToday ? 'bg-orange-50/50 border-orange-200' : 'border-foreground/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-2xl p-2 ${isToday ? 'bg-orange-100' : 'bg-slate-100'}`}>
                      <PaymentIcon className={`size-5 ${isToday ? 'text-orange-600' : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium">{sale.saleNumber}</p>
                      <p className="text-sm text-foreground/50">
                        {sale.customer 
                          ? `${sale.customer.firstName} ${sale.customer.lastName || ''}`
                          : 'Cliente general'}
                        {sale.employee && ` • ${sale.employee.firstName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl">S/ {Number(sale.totalAmount).toFixed(2)}</p>
                    <p className="text-sm text-foreground/50">
                      {new Date(sale.paidAt).toLocaleDateString('es-PE', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-foreground/50">
              No hay ventas registradas. ¡Registra tu primera venta!
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
