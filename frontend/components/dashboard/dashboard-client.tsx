"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CircleDollarSign,
  Clock3,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { usePlanCapabilities } from "@/components/plan-capabilities/plan-capabilities-provider";
import { Button } from "@/components/ui/button";
import { hasEffectivePermission } from "@/types/permissions";
import type { DashboardOverview } from "@/types/dashboard";

interface DashboardClientProps {
  tenantMetrics: DashboardOverview | null;
  roles: string[];
  dateLabel: string;
  consultedAt: string;
}

export function DashboardClient({
  tenantMetrics: metrics,
  roles,
  dateLabel,
  consultedAt,
}: DashboardClientProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const { can } = usePlanCapabilities();
  const canSell = hasEffectivePermission(roles, "sale:create") && can("sales");
  const canSeeSales =
    hasEffectivePermission(roles, "sale:list") && can("sales");
  const canSeeInventory =
    hasEffectivePermission(roles, "inventory:view") && can("inventory");
  const canSeeCustomers =
    hasEffectivePermission(roles, "customer:list") && can("customers");
  const canSeeReports =
    roles.some((role) =>
      ["COMPANY_ADMIN", "MANAGER", "CASHIER"].includes(role),
    ) && can("reports");
  const personal = metrics?.salesScope === "SELLER";
  const companyCurrency = metrics?.company?.currency;
  const currency =
    companyCurrency && /^[A-Z]{3}$/.test(companyCurrency)
      ? companyCurrency
      : "PEN";
  const money = (value: number) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  const count = (value: number) => new Intl.NumberFormat("es-PE").format(value);
  const average =
    metrics && metrics.salesToday > 0
      ? metrics.revenueToday / metrics.salesToday
      : null;
  const stock = metrics?.inventoryMetrics;
  const inventoryCoverage = metrics?.dataCoverage?.inventory;
  const partialInventory = inventoryCoverage?.truncated ?? false;
  const hasStockAlerts =
    !!stock && (stock.lowStockCount > 0 || stock.outOfStockCount > 0);
  const refresh = () => startRefresh(() => router.refresh());
  const shortcuts = [
    ...(canSeeSales
      ? [
          {
            href: "/sales",
            title: "Historial de ventas",
            description: personal
              ? "Consulta las ventas que realizaste."
              : "Busca y revisa tus operaciones.",
            icon: ShoppingBag,
          },
        ]
      : []),
    ...(canSeeCustomers
      ? [
          {
            href: "/customers",
            title: "Clientes",
            description: "Encuentra a quién atender después.",
            icon: Users,
          },
        ]
      : []),
    ...(canSeeInventory
      ? [
          {
            href: "/inventory",
            title: "Inventario",
            description: "Consulta existencias y movimientos.",
            icon: Package,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-4 sm:space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-orange-500"
              aria-hidden="true"
            />
            <span>{metrics?.company?.name ?? "Tu espacio de trabajo"}</span>
            <span className="text-border" aria-hidden="true">
              /
            </span>
            <span>Resumen operativo</span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Lo importante, hoy.
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {personal
              ? "Tus ventas y accesos para continuar el día."
              : "El pulso de tu negocio y lo que necesita tu atención."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            aria-label="Actualizar resumen"
            disabled={refreshing}
            onClick={refresh}
            className="h-10 w-10 rounded-xl bg-card p-0"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          {canSell && (
            <Button
              asChild
              className="h-10 rounded-xl bg-orange-600 px-4 text-white hover:bg-orange-700"
            >
              <Link href="/sales/new" prefetch={false}>
                <Plus className="size-4" />
                Nueva venta
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section aria-labelledby="daily-summary-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="daily-summary-title" className="text-sm font-semibold">
            Resumen del día
          </h2>
          <p className="text-xs text-muted-foreground">
            {dateLabel}
            <span className="mx-2 text-border" aria-hidden="true">
              ·
            </span>
            {personal ? "Solo tus ventas" : "Todo el negocio"}
          </p>
        </div>
        {metrics ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-[1.45fr_1fr_1fr]">
            <div className="relative col-span-2 overflow-hidden rounded-2xl bg-slate-950 p-6 text-white sm:p-7 xl:col-span-1">
              <div
                className="absolute inset-y-7 left-0 w-1 rounded-r-full bg-orange-500"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-white/65">
                  {personal ? "Tu importe vendido hoy" : "Importe vendido hoy"}
                </p>
                <Wallet className="size-5 text-orange-400" aria-hidden="true" />
              </div>
              <p className="mt-7 break-words font-display text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {money(metrics.revenueToday)}
              </p>
              <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/55">
                <span
                  className="size-1.5 rounded-full bg-orange-400"
                  aria-hidden="true"
                />
                Solo ventas completadas
              </div>
            </div>
            <div className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Ventas de hoy
                </p>
                <ShoppingCart
                  className="size-5 text-muted-foreground/60"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-7 font-display text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {count(metrics.salesToday)}
              </p>
              <p className="mt-auto pt-5 text-xs leading-5 text-muted-foreground">
                {metrics.salesToday === 0
                  ? "Todavía no hay ventas completadas."
                  : metrics.salesToday === 1
                    ? "Una operación completada."
                    : "Operaciones completadas."}
              </p>
            </div>
            <div className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Ticket promedio
                </p>
                <CircleDollarSign
                  className="size-5 text-muted-foreground/60"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-7 break-words font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                {average === null ? "—" : money(average)}
              </p>
              <p className="mt-auto pt-5 text-xs leading-5 text-muted-foreground">
                {average === null
                  ? "Se calcula con la primera venta del día."
                  : "Importe promedio por venta de hoy."}
              </p>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="rounded-2xl border border-border bg-card p-8 text-center"
          >
            <TriangleAlert className="mx-auto mb-3 size-6 text-muted-foreground" />
            <h3 className="font-semibold">El resumen no está disponible</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Actualiza para volver a consultar tus datos.
            </p>
            <Button
              variant="outline"
              onClick={refresh}
              disabled={refreshing}
              className="mt-4"
            >
              Volver a consultar
            </Button>
          </div>
        )}
      </section>

      <div
        className={`grid gap-5 ${canSeeInventory && stock ? "xl:grid-cols-[1.1fr_0.9fr]" : ""}`}
      >
        {canSeeInventory && stock && (
          <section
            aria-labelledby="attention-title"
            className="flex flex-col rounded-2xl border border-border/70 bg-card p-6 sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Siguiente paso
                </p>
                <h2
                  id="attention-title"
                  className="font-display text-xl font-semibold"
                >
                  Atención al inventario
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${hasStockAlerts ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}
              >
                {hasStockAlerts ? (
                  <TriangleAlert className="size-3" />
                ) : (
                  <Check className="size-3" />
                )}
                {hasStockAlerts
                  ? "Revisión sugerida"
                  : partialInventory
                    ? "Muestra sin alertas"
                    : "Sin alertas de stock"}
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {hasStockAlerts
                ? "Revisa las existencias antes de tu siguiente reposición."
                : "No hay alertas de reposición en los productos consultados."}
            </p>
            <div className="mt-6 grid grid-cols-2 divide-x divide-border rounded-xl bg-muted/40 py-4">
              <div className="px-5">
                <p className="font-display text-3xl font-semibold tabular-nums">
                  {count(stock.lowStockCount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bajo el mínimo o agotados
                </p>
              </div>
              <div className="px-5">
                <p
                  className={`font-display text-3xl font-semibold tabular-nums ${stock.outOfStockCount > 0 ? "text-orange-600 dark:text-orange-400" : ""}`}
                >
                  {count(stock.outOfStockCount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  De ellos, sin existencias
                </p>
              </div>
            </div>
            {inventoryCoverage?.truncated && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Resumen de {count(inventoryCoverage.returned)} de{" "}
                {count(inventoryCoverage.total)} productos consultados.
              </p>
            )}
            <Link
              href="/inventory"
              className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-foreground hover:text-orange-600"
            >
              Revisar inventario
              <ArrowRight className="size-4" />
            </Link>
          </section>
        )}

        {shortcuts.length > 0 && (
          <section
            aria-labelledby="shortcuts-title"
            className="rounded-2xl border border-border/70 bg-card p-6 sm:p-7"
          >
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              A mano
            </p>
            <h2
              id="shortcuts-title"
              className="font-display text-xl font-semibold"
            >
              Continúa desde aquí
            </h2>
            <div className="mt-4 divide-y divide-border/60">
              {shortcuts.map(({ href, title, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className="group flex items-center gap-3 py-4 first:pt-2 last:pb-0"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/35 transition-colors group-hover:border-orange-500/30 group-hover:bg-orange-500/10">
                    <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-orange-600" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {canSeeReports && (
        <Link
          href="/reports"
          prefetch={false}
          className="group flex flex-col justify-between gap-4 rounded-2xl border border-dashed border-border bg-muted/20 p-5 transition-colors hover:border-orange-500/40 hover:bg-muted/40 sm:flex-row sm:items-center"
        >
          <span className="flex items-center gap-3">
            <BarChart3 className="size-5 shrink-0 text-muted-foreground" />
            <span>
              <span className="block text-sm font-semibold">
                ¿Buscas un análisis más completo?
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Compara períodos y consulta resultados detallados en Reportes.
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold">
            Abrir reportes
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock3 className="size-3" aria-hidden="true" />
        Última consulta: {consultedAt}
      </p>
    </div>
  );
}
