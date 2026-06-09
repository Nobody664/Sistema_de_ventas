'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Package, History, Layers, Building2, Truck, AlertTriangle } from 'lucide-react';

interface InventoryPageClientProps {
  totalValue: string;
  expiringCount: number;
  suggestionsCount: number;
}

export function InventoryPageClient({ totalValue, expiringCount, suggestionsCount }: InventoryPageClientProps) {
  const modules = [
    {
      title: 'Kardex Valorizado',
      description: 'Movimientos valorizados con costeo FIFO / Promedio Ponderado',
      href: '/inventory/kardex',
      icon: History,
      color: 'from-blue-500 to-indigo-700',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Lotes',
      description: 'Gestión de lotes por producto con control FEFO',
      href: '/inventory/batches',
      icon: Layers,
      color: 'from-emerald-500 to-teal-700',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-600',
      badge: expiringCount > 0 ? `${expiringCount} por vencer` : undefined,
    },
    {
      title: 'Sucursales',
      description: 'Administra múltiples sucursales y almacenes',
      href: '/inventory/branches',
      icon: Building2,
      color: 'from-amber-500 to-orange-700',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-600',
    },
    {
      title: 'Reposición',
      description: 'Sugerencias de compra y pronóstico de demanda',
      href: '/inventory/replenishment',
      icon: Truck,
      color: 'from-purple-500 to-pink-700',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-600',
      badge: suggestionsCount > 0 ? `${suggestionsCount} sugerencias` : undefined,
    },
  ];
  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-slate-800 to-slate-950 p-8 text-white animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Gestión de inventario</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Inventario</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Control de stock, kardex valorizado, lotes, sucursales y reposición inteligente.
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-sm">
            <Package className="size-8 text-emerald-400" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/50">Valor inventario</p>
              <p className="font-display text-2xl">S/ {Number(totalValue).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.href} href={mod.href}>
              <Card
                className="group rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up transition-all hover:scale-[1.02]"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className={`rounded-2xl ${mod.iconBg} p-2`}>
                    <Icon className={`size-5 ${mod.iconColor}`} />
                  </div>
                  {mod.badge && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {mod.badge}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="font-display text-lg">{mod.title}</h3>
                  <p className="mt-1 text-sm text-foreground/50">{mod.description}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {(expiringCount > 0 || suggestionsCount > 0) && (
        <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-500">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <h2 className="font-display text-xl">Alertas activas</h2>
          </div>
          <div className="space-y-3">
            {expiringCount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">Lotes próximos a vencer</p>
                  <p className="text-xs text-amber-600">{expiringCount} lotes vencen en los próximos 7 días</p>
                </div>
                <Link href="/inventory/batches" className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-white hover:bg-amber-600">
                  Revisar
                </Link>
              </div>
            )}
            {suggestionsCount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-blue-800">Productos por reabastecer</p>
                  <p className="text-xs text-blue-600">{suggestionsCount} productos necesitan reposición</p>
                </div>
                <Link href="/inventory/replenishment" className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-medium text-white hover:bg-blue-600">
                  Revisar
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
