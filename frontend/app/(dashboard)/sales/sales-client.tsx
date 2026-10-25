"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  ShoppingCart,
  CreditCard,
  Banknote,
  TrendingUp,
  Calendar,
  Download,
} from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/store/ui-store";
import type { Sale } from "@/types/api";
import type { SalesMetrics } from "@/types/sales";

interface SalesPageClientProps {
  sales: Sale[];
  metrics: SalesMetrics | null;
}

export function SalesPageClient({
  sales: initialSales,
  metrics: initialMetrics,
}: SalesPageClientProps) {
  const [page, setPage] = useState(1);
  const limit = 20;
  const addToast = useUiStore((state) => state.addToast);

  const {
    data: salesData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sales", { page, limit }],
    queryFn: () =>
      apiFetch<Sale[]>(`/sales?page=${page}&limit=${limit}`, {
        token: getAccessToken(),
      }),
    initialData: page === 1 ? initialSales : undefined,
    refetchInterval: 30000,
  });

  const sales = salesData ?? [];
  const {
    data: metrics,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ["sales", "metrics"],
    queryFn: () =>
      apiFetch<SalesMetrics>("/dashboard/tenant", { token: getAccessToken() }),
    initialData: initialMetrics ?? undefined,
    refetchInterval: 30000,
  });
  const totalSalesCount = metrics?.salesAnalytics.totalSales;
  const avgTicket = metrics?.salesAnalytics.averageTicket;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parseSaleDate = (sale: Sale) => {
    return new Date(sale.createdAt);
  };
  const isTodaySale = (sale: Sale) => {
    const date = parseSaleDate(sale);
    return date >= today;
  };
  const salesToday = metrics?.salesToday;
  const revenueToday = metrics?.revenueToday;

  const paymentMethods: Record<
    string,
    { icon: typeof CreditCard; label: string }
  > = {
    CASH: { icon: Banknote, label: "Efectivo" },
    CARD: { icon: CreditCard, label: "Tarjeta" },
    TRANSFER: { icon: Banknote, label: "Transferencia" },
  };

  const channelLabels: Record<string, { label: string; className: string }> = {
    POS: { label: "Tienda", className: "bg-orange-500/15 text-orange-700" },
    ONLINE: { label: "Online", className: "bg-blue-500/15 text-blue-700" },
    DISTRIBUTOR: {
      label: "Distribuidor",
      className: "bg-violet-500/15 text-violet-700",
    },
  };

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    try {
      const params = new URLSearchParams({ format });
      const response = await apiFetch<{
        data: string;
        contentType: string;
        filename: string;
      }>(`/sales/export?${params}`, {
        token: getAccessToken(),
      });

      if (response?.data) {
        const link = document.createElement("a");
        link.href = `data:${response.contentType};base64,${response.data}`;
        link.download = response.filename;
        link.click();
      } else {
        throw new Error("El servidor no devolvió un archivo de ventas");
      }
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "No se pudo exportar las ventas",
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-rose-600 p-6 sm:p-8 text-white animate-fade-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              Punto de venta
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl sm:leading-none">
              Gestión de ventas
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Cada nueva venta registra al usuario que la realizó, fecha y hora.
              Administradores y gerentes consultan todas las ventas de su
              empresa; los cajeros ven únicamente las suyas.
            </p>
          </div>
          <div className="w-full shrink-0 sm:w-auto">
            <PermissionGuard permission="sale:create">
              <Link
                href="/sales/new"
                className="flex w-full items-center justify-center whitespace-nowrap rounded-2xl bg-white px-6 py-3 text-sm font-medium text-orange-600 transition hover:bg-white/90 sm:w-auto"
              >
                + Nueva venta
              </Link>
            </PermissionGuard>
          </div>
        </div>
      </Card>

      {metricsError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 p-4 text-sm"
        >
          No se pudieron actualizar los indicadores.{" "}
          {metrics
            ? "Se muestran los últimos datos confirmados."
            : "Los indicadores no están disponibles."}
          <button
            onClick={() => void refetchMetrics()}
            className="ml-2 underline"
          >
            Reintentar
          </button>
        </div>
      )}

      <p className="text-sm text-foreground/60">
        Indicadores de ventas completadas, calculados por el servidor para tu
        alcance de acceso.
      </p>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[30px] bg-card/80 p-6 card-hover animate-fade-in-up delay-100">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-500/20 p-2">
              <ShoppingCart className="size-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Ventas hoy
              </p>
              <p className="font-display text-3xl">{salesToday ?? "—"}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-card/80 p-6 card-hover animate-fade-in-up delay-150">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-green-500/20 p-2">
              <Banknote className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Ingresos hoy
              </p>
              <p className="font-display text-3xl">
                {revenueToday !== undefined
                  ? `S/ ${revenueToday.toFixed(2)}`
                  : "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-card/80 p-6 card-hover animate-fade-in-up delay-200">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <TrendingUp className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Ventas últimos 30 días
              </p>
              <p className="font-display text-3xl">{totalSalesCount ?? "—"}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-card/80 p-6 card-hover animate-fade-in-up delay-250">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/20 p-2">
              <CreditCard className="size-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Ticket promedio · 30 días
              </p>
              <p className="font-display text-3xl">
                {avgTicket !== undefined ? `S/ ${avgTicket.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-card/85 p-6 animate-fade-in-up delay-300">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
              Historial
            </p>
            <h2 className="mt-2 font-display text-2xl">Historial de ventas</h2>
            <p className="mt-1 text-sm text-foreground/50">
              Página {page} · hasta {limit} ventas por página ·{" "}
              {metrics?.salesScope === "SELLER"
                ? "Solo tus ventas"
                : "Ventas de la empresa"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-foreground/50">
              <Calendar className="size-4" />
              {new Date().toLocaleDateString("es-PE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            <PermissionGuard permission="sale:export">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm transition hover:bg-muted"
                  >
                    <Download className="size-4" />
                    Exportar
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void handleExport("csv")}>
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleExport("excel")}>
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleExport("pdf")}>
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>
          </div>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-auto">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 p-4 text-sm"
            >
              No se pudo actualizar el historial. {error.message}
              <button
                disabled={isFetching}
                onClick={() => void refetch()}
                className="ml-2 underline"
              >
                Reintentar
              </button>
            </div>
          )}
          {isLoading && (
            <div className="py-8 text-center text-foreground/50">
              Cargando...
            </div>
          )}
          {!isLoading && sales.length > 0
            ? sales.map((sale) => {
                const PaymentIcon =
                  paymentMethods[sale.paymentMethod]?.icon || Banknote;
                const isToday = isTodaySale(sale);
                return (
                  <Link
                    key={sale.id}
                    href={`/sales/${sale.id}`}
                    className={`flex items-center justify-between rounded-2xl border p-4 transition hover:border-orange-500/30 card-hover ${
                      isToday
                        ? "bg-orange-500/5 border-orange-500/30"
                        : "border-foreground/10"
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`rounded-2xl p-2 ${isToday ? "bg-orange-500/10" : "bg-muted"}`}
                      >
                        <PaymentIcon
                          className={`size-5 ${isToday ? "text-orange-500" : "text-muted-foreground"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {sale.saleNumber}
                          </p>
                          {(() => {
                            const info =
                              channelLabels[
                                (sale as { channel?: string }).channel ?? "POS"
                              ] ?? channelLabels.POS;
                            return (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}
                              >
                                {info.label}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-sm text-foreground/50 truncate">
                          {sale.customer && sale.customer.firstName
                            ? `${sale.customer.firstName} ${sale.customer.lastName || ""}`
                            : "Cliente general"}
                          {sale.employee &&
                            sale.employee.firstName &&
                            ` • ${sale.employee.firstName}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display text-xl">
                        S/ {Number(sale.totalAmount || 0).toFixed(2)}
                      </p>
                      <p className="text-sm text-foreground/50">
                        {new Date(sale.createdAt).toLocaleString("es-PE", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </Link>
                );
              })
            : !isLoading &&
              !error && (
                <div className="py-8 text-center text-foreground/50">
                  {page === 1
                    ? "No hay ventas registradas. ¡Registra tu primera venta!"
                    : "No hay más ventas en esta página."}
                </div>
              )}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            disabled={page === 1 || isFetching}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-foreground/60">Página {page}</span>
          <button
            disabled={isFetching || !!error || sales.length < limit}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </Card>
    </div>
  );
}
