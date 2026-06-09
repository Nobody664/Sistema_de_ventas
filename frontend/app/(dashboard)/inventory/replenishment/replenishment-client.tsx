'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Truck, TrendingUp, AlertTriangle, Package } from 'lucide-react';

interface ReplenishmentPageClientProps {
  suggestions: Array<Record<string, unknown>>;
  forecast: Array<Record<string, unknown>>;
}

export function ReplenishmentPageClient({ suggestions, forecast }: ReplenishmentPageClientProps) {
  const [tab, setTab] = useState<'suggestions' | 'forecast'>('suggestions');

  const suggestionsWithStock = suggestions.filter((s) => (s.currentStock as number) <= (s.reorderPoint as number));
  const highPriority = suggestionsWithStock.filter((s) => s.priority === 'high');
  const mediumPriority = suggestionsWithStock.filter((s) => s.priority === 'medium');

  const classifiedForecast = useMemo(() => {
    const a = forecast.filter((f) => f.classification === 'A');
    const b = forecast.filter((f) => f.classification === 'B');
    const c = forecast.filter((f) => f.classification === 'C');
    return { a, b, c };
  }, [forecast]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-purple-500 to-pink-700 p-8 text-white animate-fade-in-up">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-white/60">Inventario</p>
          <h1 className="mt-4 font-display text-5xl leading-none">Reposición</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            Sugerencias de compra inteligentes y pronóstico de demanda.
          </p>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-500/20 p-2">
              <AlertTriangle className="size-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Prioridad alta</p>
              <p className="font-display text-3xl text-red-600">{highPriority.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/20 p-2">
              <Truck className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Sugerencias totales</p>
              <p className="font-display text-3xl">{suggestionsWithStock.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2">
              <TrendingUp className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Clasificación A</p>
              <p className="font-display text-3xl text-emerald-600">{classifiedForecast.a.length} prod.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-250">
        <div className="mb-6 flex items-center gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Inventario</p>
            <h2 className="mt-2 font-display text-2xl">
              {tab === 'suggestions' ? 'Sugerencias de compra' : 'Pronóstico de demanda'}
            </h2>
          </div>
          <div className="ml-auto flex rounded-xl border border-foreground/10 p-1">
            <button
              onClick={() => setTab('suggestions')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === 'suggestions' ? 'bg-purple-500 text-white' : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Sugerencias
            </button>
            <button
              onClick={() => setTab('forecast')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === 'forecast' ? 'bg-purple-500 text-white' : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Pronóstico ABC
            </button>
          </div>
        </div>

        {tab === 'suggestions' ? (
          <div className="overflow-auto max-h-[600px] rounded-xl border border-foreground/10">
            <table className="w-full min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                  <th className="pb-4 pl-4 font-medium">Producto</th>
                  <th className="pb-4 font-medium">SKU</th>
                  <th className="pb-4 font-medium text-right">Stock actual</th>
                  <th className="pb-4 font-medium text-right">Reorder point</th>
                  <th className="pb-4 font-medium text-right">Sugerido</th>
                  <th className="pb-4 pr-4 font-medium text-right">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {suggestionsWithStock.length > 0 ? (
                  suggestionsWithStock.map((s, i) => (
                    <tr key={s.productId as string} className="border-b border-foreground/5 table-row-hover">
                      <td className="py-3 pl-4 text-sm font-medium">{s.productName as string}</td>
                      <td className="py-3 text-sm text-foreground/60">{s.sku as string || '—'}</td>
                      <td className="py-3 text-right text-sm">{s.currentStock as number}</td>
                      <td className="py-3 text-right text-sm">{s.reorderPoint as number}</td>
                      <td className="py-3 text-right text-sm font-medium text-emerald-600">{s.suggestedOrder as number}</td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {s.priority === 'high' ? 'Alta' : 'Media'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-foreground/50">
                      No hay productos que necesiten reposición.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            {['A', 'B', 'C'].map((cls) => {
              const items = classifiedForecast[cls.toLowerCase() as keyof typeof classifiedForecast] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cls}>
                  <h3 className="mb-3 font-display text-lg">
                    Clasificación {cls}
                    <span className="ml-2 text-sm text-foreground/50">
                      ({items.length} productos)
                    </span>
                  </h3>
                  <div className="overflow-auto rounded-xl border border-foreground/10">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-white">
                        <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                          <th className="pb-3 pl-4 font-medium">Producto</th>
                          <th className="pb-3 font-medium text-right">Stock</th>
                          <th className="pb-3 font-medium text-right">Ventas (30d)</th>
                          <th className="pb-3 font-medium text-right">Demanda diaria</th>
                          <th className="pb-3 pr-4 font-medium text-right">Ingresos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={item.id as string} className="border-b border-foreground/5">
                            <td className="py-2.5 pl-4 text-sm">{item.name as string}</td>
                            <td className="py-2.5 text-right text-sm">{item.stockQuantity as number}</td>
                            <td className="py-2.5 text-right text-sm">{item.totalSold as number}</td>
                            <td className="py-2.5 text-right text-sm">{item.dailyAverage as number}</td>
                            <td className="py-2.5 pr-4 text-right text-sm font-medium">S/ {Number(item.revenue ?? 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
