"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type { DashboardMetrics } from "@/types/metrics";
import {
  Loader2,
  Receipt,
  Repeat,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

const PERIODS = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
  { label: "1 año", value: 365 },
];

function formatBucket(bucket: string, granularity: string): string {
  if (granularity === "month") {
    const [year, month] = bucket.split("-");
    return `${month}/${year.slice(2)}`;
  }
  const [, month, day] = bucket.split("-");
  return `${day}/${month}`;
}

function ChangeBadge({
  value,
  suffix = "%",
}: {
  value: number;
  suffix?: string;
}) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        positive
          ? "bg-emerald-500/15 text-emerald-600"
          : "bg-red-500/15 text-red-600"
      }`}
    >
      <Icon className="size-3" />
      {positive ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

export function DashboardMetricsPanel() {
  const addToast = useUiStore((state) => state.addToast);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (selectedDays: number) => {
      setLoading(true);
      try {
        const result = await apiFetch<DashboardMetrics>(
          `/dashboard/metrics?days=${selectedDays}`,
        );
        setData(result);
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : "Error al cargar métricas",
          "error",
        );
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const chartData =
    data?.trend.map((point) => ({
      bucket: formatBucket(point.bucket, data.period.granularity),
      revenue: Number(point.revenue.toFixed(2)),
      sales: point.sales,
    })) ?? [];

  return (
    <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
            Métricas
          </p>
          <h2 className="mt-2 font-display text-2xl">
            Rendimiento del período
          </h2>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-foreground/5 p-1">
          {PERIODS.map((period) => (
            <button
              key={period.value}
              type="button"
              onClick={() => setDays(period.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                days === period.value
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-foreground/50 hover:text-foreground"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-orange-500" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Ingresos"
              value={`S/ ${data.summary.totalRevenue.toFixed(2)}`}
              icon={Wallet}
              change={data.comparison.revenueChange}
            />
            <MetricTile
              label="Ventas"
              value={data.summary.totalSales}
              icon={ShoppingCart}
              change={data.comparison.salesChange}
            />
            <MetricTile
              label="Ticket promedio"
              value={`S/ ${data.summary.averageTicket.toFixed(2)}`}
              icon={Receipt}
              change={data.comparison.averageTicketChange}
            />
            <MetricTile
              label="Rotación"
              value={`${data.rotation.globalRotation.toFixed(2)}x`}
              icon={Repeat}
            />
          </div>

          <div className="h-64 sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="metricsRevenueFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#eb6c3e" stopOpacity={0.45} />
                    <stop
                      offset="100%"
                      stopColor="#eb6c3e"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#e7ddcf"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="bucket"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  minTickGap={20}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  width={56}
                />
                <Tooltip
                  formatter={(value: number) => `S/ ${value.toFixed(2)}`}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#eb6c3e"
                  strokeWidth={3}
                  fill="url(#metricsRevenueFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-foreground/60">
              Rotación por producto (top vendidos)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-foreground/40">
                    <th className="py-2 pr-4">Producto</th>
                    <th className="py-2 pr-4 text-right">Vendidos</th>
                    <th className="py-2 pr-4 text-right">Stock prom.</th>
                    <th className="py-2 text-right">Rotación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {data.rotation.products.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2 pr-4">
                        <span className="line-clamp-1">{item.name}</span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {item.quantitySold}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {item.averageStock}
                      </td>
                      <td className="py-2 text-right font-medium text-orange-600">
                        {item.rotation.toFixed(2)}x
                      </td>
                    </tr>
                  ))}
                  {data.rotation.products.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-foreground/40"
                      >
                        Sin datos en el período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-foreground/50">
          No hay datos disponibles.
        </p>
      )}
    </Card>
  );
}

function MetricTile({
  label,
  value,
  icon: Icon,
  change,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  change?: number;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 p-5 transition hover:border-orange-500/30">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-orange-500/10 p-2.5">
          <Icon className="size-4 text-orange-600" />
        </div>
        {change !== undefined && <ChangeBadge value={change} />}
      </div>
      <p className="mt-3 font-display text-2xl">{value}</p>
      <p className="mt-0.5 text-sm text-foreground/50">{label}</p>
    </div>
  );
}
