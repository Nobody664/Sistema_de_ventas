"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { useAuthStore } from "@/stores/auth.store";
import { storeAdminKeys, type StoreAdminDashboard } from "../api/contracts";
import { useCommerceContext } from "./commerce-shell";

export function CommerceDashboard() {
  const { context, userId } = useCommerceContext();
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const [days, setDays] = useState(7);
  const query = useQuery({
    queryKey: storeAdminKeys(context.company.id, userId).dashboard(days),
    queryFn: ({ signal }) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: context.company.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const part = (type: string) =>
        parts.find((entry) => entry.type === type)!.value;
      const today = new Date(
        `${part("year")}-${part("month")}-${part("day")}T12:00:00Z`,
      );
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - days + 1);
      today.setUTCDate(today.getUTCDate() + 1);
      return apiFetch<StoreAdminDashboard>(
        `/store-admin/dashboard?from=${from.toISOString().slice(0, 10)}&to=${today.toISOString().slice(0, 10)}`,
        { signal },
      );
    },
    enabled:
      ready &&
      user?.id === userId &&
      user?.companyId === context.company.id &&
      context.capabilities.viewDashboard,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const data = query.data;
  const money = (value: string) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: context.company.currency,
    }).format(Number(value));
  const cards = data
    ? [
        {
          label: "Pedidos creados",
          value: String(data.metrics.ordersCreated.value),
          hint: "En el período seleccionado",
          href: "/comercio/pedidos",
        },
        {
          label: "Ventas online vigentes",
          value: money(data.metrics.onlineSales.amount),
          hint: `${data.metrics.onlineSales.count} ventas no reembolsadas`,
          href: "/comercio/pagos",
        },
        {
          label: "Pagos por revisar",
          value: String(data.metrics.paymentsToReview.value),
          hint: "Pendientes actuales · todos los períodos",
          href: "/comercio/pagos",
        },
        {
          label: "Por preparar",
          value: String(data.metrics.preparationPending.value),
          hint: "Pendientes actuales · todos los períodos",
          href: "/comercio/pedidos",
        },
      ]
    : [];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
            Tu operación, en un vistazo
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Resumen de la tienda
          </h1>
          <p className="mt-3 text-sm text-foreground/55">
            Ventas, pedidos y tareas que necesitan tu atención.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="commerce-period">
            Período del resumen
          </label>
          <select
            id="commerce-period"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            {[7, 30, 90].map((value) => (
              <option key={value} value={value}>
                Últimos {value} días
              </option>
            ))}
          </select>
          <button
            aria-label="Actualizar resumen"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="rounded-xl border border-foreground/15 p-2.5 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
      {query.isError && (
        <div role="alert" className="rounded-xl border border-red-400/40 p-5">
          <p>No se pudo cargar el resumen. {query.error.message}</p>
          <button
            onClick={() => void query.refetch()}
            className="mt-2 underline"
          >
            Reintentar
          </button>
        </div>
      )}
      {!data && !query.isError && (
        <p
          role="status"
          className="rounded-2xl border border-foreground/10 p-8"
        >
          Cargando el resumen de tu tienda…
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="group rounded-2xl border border-foreground/10 bg-card p-6 transition hover:border-primary/50"
              >
                <p className="flex items-center justify-between text-sm text-foreground/60">
                  {card.label}
                  <ArrowUpRight className="h-4 w-4 text-primary transition group-hover:-translate-y-0.5" />
                </p>
                <p className="mt-6 break-words font-display text-3xl font-semibold tabular-nums">
                  {card.value}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-foreground/50">
                  {card.hint}
                </p>
              </Link>
            ))}
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="min-w-0 rounded-2xl border border-foreground/10 bg-card p-6">
              <h2 className="font-display text-xl font-semibold">
                Actividad del canal
              </h2>
              <p className="mt-2 text-xs text-foreground/50">
                {data.range.fromKey} — {data.range.toKey} ·{" "}
                {data.range.timezone}
              </p>
              {data.metrics.ordersCreated.value === 0 &&
                data.metrics.onlineSales.count === 0 && (
                  <p className="my-6 rounded-xl bg-foreground/5 p-4 text-sm">
                    Todavía no hay actividad en este período. Comparte tu tienda
                    para recibir tus primeros pedidos.
                  </p>
                )}
              <div className="mt-6 max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Actividad diaria de pedidos y ventas vigentes
                  </caption>
                  <thead className="sticky top-0 bg-card text-xs text-foreground/50">
                    <tr>
                      <th className="py-3 pr-4">Fecha</th>
                      <th className="px-2 py-3 text-right">Pedidos</th>
                      <th className="px-2 py-3 text-right">Ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/5">
                    {data.trend.map((day) => (
                      <tr key={day.date}>
                        <td className="py-3 pr-4 tabular-nums">{day.date}</td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {day.ordersCreated}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {money(day.onlineSalesAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-foreground/45">
                Ventas actualmente completadas y vinculadas a pedidos. Este
                importe no representa flujo de caja neto.
              </p>
            </section>
            <section className="rounded-2xl border border-foreground/10 bg-card p-6">
              <p className="text-xs uppercase tracking-[.18em] text-primary">
                Atención actual
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold">
                Entregas pendientes
              </h2>
              <p className="my-6 font-display text-5xl tabular-nums">
                {data.deliveriesPending.total}
              </p>
              <div className="space-y-3 text-sm">
                <p className="flex justify-between">
                  <span>Listos para retirar</span>
                  <strong>{data.deliveriesPending.pickups}</strong>
                </p>
                <p className="flex justify-between">
                  <span>Enviados por entregar</span>
                  <strong>{data.deliveriesPending.shipments}</strong>
                </p>
              </div>
              <Link
                href="/comercio/entregas"
                className="mt-6 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Revisar entregas
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <p className="mt-5 text-xs leading-relaxed text-foreground/50">
                Estos pendientes incluyen pedidos anteriores al período
                seleccionado.
              </p>
            </section>
          </div>
          <p className="text-xs text-foreground/40">
            Actualizado:{" "}
            {new Date(data.generatedAt).toLocaleString("es-PE", {
              timeZone: context.company.timezone,
            })}
          </p>
        </>
      )}
    </div>
  );
}
