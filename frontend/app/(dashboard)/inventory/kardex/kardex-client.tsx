'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Search, TrendingUp, ArrowDownUp } from 'lucide-react';

interface KardexPageClientProps {
  initialEntries: Array<Record<string, unknown>>;
  products: Array<{ id: string; name: string; sku: string | null }>;
}

export function KardexPageClient({ initialEntries, products }: KardexPageClientProps) {
  const [entries] = useState(initialEntries);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const p = e.product as { name?: string } | undefined;
      const matchProduct = !productFilter || e.productId === productFilter;
      const matchType = !typeFilter || e.movementType === typeFilter;
      return matchProduct && matchType;
    });
  }, [entries, productFilter, typeFilter]);

  const totalValue = entries.reduce((sum, e) => {
    const balance = e.balanceTotalCost ? Number(e.balanceTotalCost) : 0;
    return sum + balance;
  }, 0);

  const totalIn = entries
    .filter((e) => e.movementType === 'IN')
    .reduce((s, e) => s + (e.qtyIn as number ?? 0), 0);
  const totalOut = entries
    .filter((e) => e.movementType === 'OUT')
    .reduce((s, e) => s + (e.qtyOut as number ?? 0), 0);

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-slate-800 to-slate-950 p-8 text-white animate-fade-in-up">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-white/60">Inventario</p>
          <h1 className="mt-4 font-display text-5xl leading-none">Kardex Valorizado</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            Registro cronológico de entradas, salidas y saldos valorizados de inventario.
          </p>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <TrendingUp className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Valor inventario</p>
              <p className="font-display text-3xl">S/ {totalValue.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2">
              <ArrowDownUp className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Entradas</p>
              <p className="font-display text-3xl">{totalIn} unid.</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-500/20 p-2">
              <ArrowDownUp className="size-5 rotate-180 text-red-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Salidas</p>
              <p className="font-display text-3xl">{totalOut} unid.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-250">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Movimientos</p>
            <h2 className="mt-2 font-display text-2xl">Registro valorizado</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="rounded-xl border border-foreground/10 bg-white py-2 pl-9 pr-4 text-sm transition focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="">Todos los productos</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-foreground/10 bg-white px-4 py-2 text-sm transition focus:border-emerald-500/50 focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="ADJUSTMENT">Ajuste</option>
              <option value="RETURN">Devolución</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto max-h-[600px] rounded-xl border border-foreground/10">
          <table className="w-full min-w-[1000px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="pb-4 pl-4 font-medium">Fecha</th>
                <th className="pb-4 font-medium">Producto</th>
                <th className="pb-4 font-medium">Tipo</th>
                <th className="pb-4 font-medium text-right">Entrada</th>
                <th className="pb-4 font-medium text-right">Costo U.</th>
                <th className="pb-4 font-medium text-right">Costo T.</th>
                <th className="pb-4 font-medium text-right">Salida</th>
                <th className="pb-4 font-medium text-right">Costo U.</th>
                <th className="pb-4 font-medium text-right">Costo T.</th>
                <th className="pb-4 font-medium text-right">Saldo Qty</th>
                <th className="pb-4 pr-4 font-medium text-right">Saldo S/</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry, i) => {
                  const product = entry.product as { name?: string } | undefined;
                  return (
                    <tr key={entry.id as string} className="border-b border-foreground/5 table-row-hover animate-fade-in-up" style={{ animationDelay: `${i * 20}ms` }}>
                      <td className="py-3 pl-4 text-sm">
                        {new Date(entry.movementDate as string).toLocaleString()}
                      </td>
                      <td className="py-3 text-sm font-medium">
                        {product?.name ?? '—'}
                      </td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.movementType === 'IN' ? 'bg-emerald-100 text-emerald-700' :
                          entry.movementType === 'OUT' ? 'bg-red-100 text-red-700' :
                          entry.movementType === 'ADJUSTMENT' ? 'bg-blue-100 text-blue-700' :
                          entry.movementType === 'RETURN' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {entry.movementType as string}
                        </span>
                      </td>
                      <td className="py-3 text-right text-sm">{entry.qtyIn as number > 0 ? entry.qtyIn as number : '—'}</td>
                      <td className="py-3 text-right text-sm">{entry.unitCostIn ? `S/ ${Number(entry.unitCostIn).toFixed(2)}` : '—'}</td>
                      <td className="py-3 text-right text-sm">{entry.totalCostIn ? `S/ ${Number(entry.totalCostIn).toFixed(2)}` : '—'}</td>
                      <td className="py-3 text-right text-sm">{entry.qtyOut as number > 0 ? entry.qtyOut as number : '—'}</td>
                      <td className="py-3 text-right text-sm">{entry.unitCostOut ? `S/ ${Number(entry.unitCostOut).toFixed(2)}` : '—'}</td>
                      <td className="py-3 text-right text-sm">{entry.totalCostOut ? `S/ ${Number(entry.totalCostOut).toFixed(2)}` : '—'}</td>
                      <td className="py-3 text-right text-sm font-medium">{entry.balanceQty as number}</td>
                      <td className="py-3 pr-4 text-right text-sm font-medium">S/ {Number(entry.balanceTotalCost).toFixed(2)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-foreground/50">
                    No se encontraron movimientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
