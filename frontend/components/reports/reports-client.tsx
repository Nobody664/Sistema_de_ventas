"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  Store,
  Globe,
  Truck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

type ChannelCode = "POS" | "DISTRIBUTOR" | "ONLINE";

interface SalesByChannel {
  channel: ChannelCode;
  sales: number;
  revenue: number;
}

export interface ReportOverview {
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  averageTicket: number;
  revenueChange: number;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByDay: Array<{ date: string; sales: number; revenue: number }>;
  byChannel: SalesByChannel[];
  filters: {
    channel: ChannelCode | null;
    startDate: string | null;
    endDate: string | null;
  };
}

const CHANNEL_META: Record<
  ChannelCode,
  { label: string; icon: typeof Store; bar: string; chip: string }
> = {
  POS: {
    label: "Tienda",
    icon: Store,
    bar: "from-orange-400 to-orange-600",
    chip: "bg-orange-500/15 text-orange-700",
  },
  ONLINE: {
    label: "Online",
    icon: Globe,
    bar: "from-blue-400 to-blue-600",
    chip: "bg-blue-500/15 text-blue-700",
  },
  DISTRIBUTOR: {
    label: "Distribuidor",
    icon: Truck,
    bar: "from-violet-400 to-violet-600",
    chip: "bg-violet-500/15 text-violet-700",
  },
};

export function ReportsClient({ initial }: { initial: ReportOverview }) {
  const addToast = useUiStore((state) => state.addToast);

  const [data, setData] = useState<ReportOverview>(initial);
  const [channel, setChannel] = useState<"" | ChannelCode>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channel) params.set("channel", channel);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const query = params.toString();
      const result = await apiFetch<ReportOverview>(
        `/reports/overview${query ? `?${query}` : ""}`,
        {
          token: getAccessToken(),
        },
      );
      setData(result);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Error al cargar reportes",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, startDate, endDate]);

  const hasFilters = channel !== "" || startDate !== "" || endDate !== "";

  const clearFilters = () => {
    setChannel("");
    setStartDate("");
    setEndDate("");
  };

  const maxChannelRevenue = Math.max(
    1,
    ...data.byChannel.map((c) => c.revenue),
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-slate-700 to-slate-900 p-6 sm:p-8 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              Inteligencia de negocio
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl sm:leading-none">
              Reportes y analytics
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Analiza el rendimiento por canal de venta y rango de fechas.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/60">
                Canal
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as "" | ChannelCode)}
                className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none [&>option]:text-foreground"
              >
                <option value="">Todos</option>
                <option value="POS">Tienda</option>
                <option value="ONLINE">Online</option>
                <option value="DISTRIBUTOR">Distribuidor</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/60">
                Desde
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/60">
                Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="h-10 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
            >
              <X className="mr-1 size-4" />
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/60">
          <Filter className="size-4" />
          Filtrando por
          {channel && (
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-medium">
              {CHANNEL_META[channel].label}
            </span>
          )}
          {startDate && (
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-medium">
              desde {startDate}
            </span>
          )}
          {endDate && (
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-medium">
              hasta {endDate}
            </span>
          )}
          {loading && <Loader2 className="size-4 animate-spin" />}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            Ventas totales
          </p>
          <p className="mt-4 font-display text-3xl">{data.totalSales}</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            Ingresos
          </p>
          <p className="mt-4 font-display text-3xl">
            S/ {data.totalRevenue.toFixed(2)}
          </p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            Clientes únicos
          </p>
          <p className="mt-4 font-display text-3xl">{data.totalCustomers}</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            Ticket promedio
          </p>
          <p className="mt-4 font-display text-3xl">
            S/ {data.averageTicket.toFixed(2)}
          </p>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            Distribución
          </p>
          <h2 className="mt-2 font-display text-2xl">Ventas por canal</h2>
        </div>
        {data.byChannel.length > 0 ? (
          <div className="space-y-4">
            {data.byChannel.map((entry) => {
              const meta = CHANNEL_META[entry.channel];
              const Icon = meta.icon;
              const width = (entry.revenue / maxChannelRevenue) * 100;
              return (
                <div key={entry.channel} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <Icon className="size-4 text-foreground/60" />
                      {meta.label}
                    </span>
                    <span className="shrink-0 text-foreground/60">
                      {entry.sales} ventas · S/ {entry.revenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-foreground/5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${meta.bar}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-foreground/50">
            No hay ventas en el rango seleccionado.
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-[34px] bg-white/85 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                Tendencia
              </p>
              <h2 className="mt-2 font-display text-2xl">
                Variación de ingresos
              </h2>
            </div>
            <div
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                data.revenueChange >= 0
                  ? "bg-green-500/20 text-green-700"
                  : "bg-red-500/20 text-red-700"
              }`}
            >
              {data.revenueChange >= 0 ? (
                <TrendingUp className="size-4" />
              ) : (
                <TrendingDown className="size-4" />
              )}
              {Math.abs(data.revenueChange).toFixed(1)}%
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {data.salesByDay.length > 0 ? (
              data.salesByDay.map((day, idx) => {
                const maxRevenue = Math.max(
                  ...data.salesByDay.map((d) => d.revenue),
                  1,
                );
                const barWidth = (day.revenue / maxRevenue) * 100;
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="w-20 text-sm text-foreground/50">
                      {day.date}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-foreground/5">
                      <div
                        className="h-6 rounded-full bg-gradient-to-r from-slate-600 to-slate-800 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm font-medium">
                      S/ {day.revenue.toFixed(0)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-foreground/50">
                No hay datos de tendencias en el rango.
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-[34px] bg-white/85 p-6">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
              Productos
            </p>
            <h2 className="mt-2 font-display text-2xl">Más vendidos</h2>
          </div>

          <div className="space-y-4">
            {data.topProducts.length > 0 ? (
              data.topProducts.map((product, idx) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium">
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium">{product.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display">{product.quantity} uds</p>
                    <p className="text-sm text-foreground/50">
                      S/ {product.revenue.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-foreground/50">
                No hay datos de productos en el rango.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
