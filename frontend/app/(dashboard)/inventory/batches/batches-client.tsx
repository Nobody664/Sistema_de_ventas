'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Layers, Search, AlertTriangle, Calendar } from 'lucide-react';

interface BatchesPageClientProps {
  initialBatches: Array<Record<string, unknown>>;
  products: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  expiringBatches: Array<Record<string, unknown>>;
}

export function BatchesPageClient({ initialBatches, products, branches, expiringBatches }: BatchesPageClientProps) {
  const [batches] = useState(initialBatches);
  const [productFilter, setProductFilter] = useState('');
  const [showExpiring, setShowExpiring] = useState(false);

  const filteredBatches = useMemo(() => {
    let list = batches;
    if (showExpiring) {
      list = expiringBatches;
    }
    if (productFilter) {
      list = list.filter((b) => b.productId === productFilter);
    }
    return list;
  }, [batches, productFilter, showExpiring, expiringBatches]);

  const totalBatches = batches.length;
  const totalUnits = batches.reduce((s, b) => s + (b.quantityAvailable as number ?? 0), 0);
  const totalExpiring = expiringBatches.length;

  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-700 p-8 text-white animate-fade-in-up">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-white/60">Inventario</p>
          <h1 className="mt-4 font-display text-5xl leading-none">Lotes</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            Gestión de lotes por producto con control FEFO (First Expired, First Out).
          </p>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2">
              <Layers className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total lotes</p>
              <p className="font-display text-3xl">{totalBatches}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <Layers className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Unidades disponibles</p>
              <p className="font-display text-3xl">{totalUnits}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-200">
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-2 ${totalExpiring > 0 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              <AlertTriangle className={`size-5 ${totalExpiring > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Por vencer (7d)</p>
              <p className={`font-display text-3xl ${totalExpiring > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalExpiring}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-250">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Inventario</p>
              <h2 className="mt-2 font-display text-2xl">Lista de lotes</h2>
            </div>
            {totalExpiring > 0 && (
              <button
                onClick={() => setShowExpiring(!showExpiring)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                  showExpiring ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                <Calendar className="size-3" />
                {showExpiring ? 'Mostrar todos' : `${totalExpiring} por vencer`}
              </button>
            )}
          </div>
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
        </div>

        <div className="overflow-auto max-h-[600px] rounded-xl border border-foreground/10">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="pb-4 pl-4 font-medium">Producto</th>
                <th className="pb-4 font-medium">Lote</th>
                <th className="pb-4 font-medium">Sucursal</th>
                <th className="pb-4 font-medium text-right">Recibido</th>
                <th className="pb-4 font-medium text-right">Disponible</th>
                <th className="pb-4 font-medium text-right">Precio Compra</th>
                <th className="pb-4 font-medium text-right">Vencimiento</th>
                <th className="pb-4 pr-4 font-medium text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length > 0 ? (
                filteredBatches.map((batch, i) => {
                  const productName = productMap.get(batch.productId as string) ?? '—';
                  const branchName = batch.branchId ? branchMap.get(batch.branchId as string) : '—';
                  const expDate = batch.expirationDate ? new Date(batch.expirationDate as string) : null;
                  const isExpiring = expDate && expDate < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                  const isExpired = expDate && expDate < new Date();

                  return (
                    <tr key={batch.id as string} className="border-b border-foreground/5 table-row-hover">
                      <td className="py-3 pl-4 text-sm font-medium">{productName}</td>
                      <td className="py-3 text-sm font-mono">{batch.batchNumber as string}</td>
                      <td className="py-3 text-sm text-foreground/60">{branchName}</td>
                      <td className="py-3 text-right text-sm">{batch.quantityReceived as number}</td>
                      <td className="py-3 text-right text-sm font-medium">{batch.quantityAvailable as number}</td>
                      <td className="py-3 text-right text-sm">S/ {Number(batch.purchasePrice).toFixed(2)}</td>
                      <td className="py-3 text-right text-sm">
                        {expDate ? (
                          <span className={isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : ''}>
                            {expDate.toLocaleDateString()}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {isExpired ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Vencido</span>
                        ) : isExpiring ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Por vencer</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Vigente</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-foreground/50">
                    No se encontraron lotes.
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
