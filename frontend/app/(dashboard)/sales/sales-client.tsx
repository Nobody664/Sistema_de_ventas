'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ShoppingCart, DollarSign, CreditCard, Banknote, TrendingUp, Calendar, Download } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Product, Customer, Sale } from '@/types/api';

interface SalesPageClientProps {
  sales: Sale[];
  products?: Product[];
  customers?: Customer[];
}

export function SalesPageClient({ sales: initialSales, products, customers }: SalesPageClientProps) {
  const { data: session } = useSession();

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiFetch<Sale[]>('/sales', { token: session?.accessToken }),
    initialData: initialSales,
    refetchInterval: 30000,
  });

  console.log('SalesClient: salesData', salesData);
  const sales = salesData ?? initialSales;
  console.log('SalesClient: sales', sales);

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
  const totalSalesCount = sales.length;
  const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const salesToday = sales.filter(s => new Date(s.paidAt) >= today).length;
  const revenueToday = sales.filter(s => new Date(s.paidAt) >= today).reduce((acc, s) => acc + Number(s.totalAmount), 0);

  const paymentMethods: Record<string, { icon: typeof CreditCard; label: string }> = {
    CASH: { icon: Banknote, label: 'Efectivo' },
    CARD: { icon: CreditCard, label: 'Tarjeta' },
    TRANSFER: { icon: DollarSign, label: 'Transferencia' },
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({ format });
      const response = await apiFetch<{ data: string; contentType: string; filename: string }>(`/sales/export?${params}`, {
        token: session?.accessToken,
      });

      if (response?.data) {
        const link = document.createElement('a');
        link.href = `data:${response.contentType};base64,${response.data}`;
        link.download = response.filename;
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-rose-600 p-8 text-white animate-fade-in-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Punto de venta</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Gestion de ventas</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Registra nuevas ventas, consulta el historial y gestiona transacciones.
            </p>
          </div>
          <div className="lg:block">
            <Link
              href="/sales/new"
              className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-orange-600 transition hover:bg-white/90"
            >
              + Nueva venta
            </Link>
          </div>
        </div>
      </Card>

      <div className="fixed bottom-6 right-6 z-40 lg:hidden">
        <Link
          href="/sales/new"
          className="rounded-full bg-orange-500 p-4 text-white shadow-lg"
        >
          <ShoppingCart className="h-6 w-6" />
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
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

        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
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

        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <TrendingUp className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total ventas</p>
              <p className="font-display text-3xl">{totalSalesCount}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-250">
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

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-300">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Historial</p>
            <h2 className="mt-2 font-display text-2xl">Ventas recientes</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-foreground/50">
              <Calendar className="size-4" />
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-white px-4 py-2 text-sm transition hover:bg-foreground/5">
                <Download className="size-4" />
                Exportar
              </button>
              <div className="absolute right-0 top-full z-10 mt-1 hidden min-w-[140px] rounded-xl border border-foreground/10 bg-white py-1 shadow-lg group-hover:block">
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5">CSV</button>
                <button onClick={() => handleExport('excel')} className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5">Excel</button>
                <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5">PDF</button>
              </div>
            </div>
            <div className="lg:hidden">
              <Link
                href="/sales/new"
                className="rounded-full bg-orange-500 p-4 text-white shadow-lg"
              >
                <ShoppingCart className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-auto">
          {isLoading && <div className="py-8 text-center text-foreground/50">Cargando...</div>}
          {!isLoading && sales.length > 0 ? (
            sales.slice(0, 15).map((sale, index) => {
              const PaymentIcon = paymentMethods[sale.paymentMethod]?.icon || DollarSign;
              const isToday = sale.paidAt ? new Date(sale.paidAt) >= today : false;
              return (
                <Link
                  key={sale.id}
                  href={`/sales/${sale.id}`}
                  className={`flex items-center justify-between rounded-2xl border p-4 transition hover:border-orange-500/30 card-hover block ${
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
                        {sale.customer && sale.customer.firstName 
                          ? `${sale.customer.firstName} ${sale.customer.lastName || ''}`
                          : 'Cliente general'}
                        {sale.employee && sale.employee.firstName && ` • ${sale.employee.firstName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl">S/ {Number(sale.totalAmount || 0).toFixed(2)}</p>
                    <p className="text-sm text-foreground/50">
                      {sale.paidAt 
                        ? new Date(sale.paidAt).toLocaleDateString('es-PE', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Sin fecha'}
                    </p>
                  </div>
                </Link>
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
