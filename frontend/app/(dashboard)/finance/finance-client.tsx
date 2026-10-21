"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  NewFinanceButton,
  FinanceRowActions,
} from "@/components/finance/finance-actions";
import type { FinanceListResponse, FinanceSummary } from "@/types/api";

interface FinanceEmployeeOption {
  id: string;
  name: string;
}

interface FinancePageClientProps {
  initialList: FinanceListResponse;
  initialSummary: FinanceSummary | null;
  employees: FinanceEmployeeOption[];
}

const CATEGORY_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  PAYROLL: "Sueldo",
  ELECTRICITY: "Luz",
  WATER: "Agua",
  MAINTENANCE: "Mantenimiento",
  OTHER: "Otro",
};

const money = (value: number): string => `S/ ${Number(value).toFixed(2)}`;

const shortDate = (value: string): string =>
  new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export function FinancePageClient({
  initialList,
  initialSummary,
  employees,
}: FinancePageClientProps) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [direction, setDirection] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const records = initialList.items;
  const totalPages = Math.max(
    Math.ceil(initialList.total / initialList.limit),
    1,
  );

  const pushQuery = (page: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (direction) params.set("direction", direction);
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    router.push(query ? `/finance?${query}` : "/finance");
  };

  const handleFilter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushQuery(1);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-700 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              Control financiero
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl sm:leading-none">
              Finanzas
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Entradas por compras a proveedores y salidas por ventas, sueldos y
              gastos de la empresa. Las ventas se registran automáticamente
              desde el módulo de Ventas.
            </p>
          </div>
          <NewFinanceButton employees={employees} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Entradas"
          value={money(initialSummary?.entries.total ?? 0)}
          hint={`${initialSummary?.entries.count ?? 0} registros`}
          tone="emerald"
        />
        <SummaryCard
          label="Salidas"
          value={money(initialSummary?.exits.total ?? 0)}
          hint={`${initialSummary?.exits.count ?? 0} registros`}
          tone="red"
        />
        <SummaryCard
          label="Ventas"
          value={money(initialSummary?.sales.total ?? 0)}
          hint={`${initialSummary?.sales.count ?? 0} ventas`}
          tone="blue"
        />
        <SummaryCard
          label="Gastos"
          value={money(initialSummary?.expenses.total ?? 0)}
          hint={`${initialSummary?.expenses.count ?? 0} gastos`}
          tone="amber"
        />
      </div>

      <div className="rounded-[30px] bg-white/85 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
              Balance del periodo
            </p>
            <p
              className={`font-display text-3xl ${
                (initialSummary?.balance ?? 0) >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {money(initialSummary?.balance ?? 0)}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {initialSummary
              ? `${shortDate(initialSummary.from)} — ${shortDate(initialSummary.to)}`
              : "Sin datos"}
          </p>
        </div>
      </div>

      <div className="rounded-[30px] bg-white/85 p-6">
        <form
          onSubmit={handleFilter}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Desde</p>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Hasta</p>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Tipo</p>
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="ENTRY">Entradas</option>
              <option value="EXIT">Salidas</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Categoría</p>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Todas</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Buscar</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Boleta, proveedor..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="col-span-full flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
                setDirection("");
                setCategory("");
                setSearch("");
                router.push("/finance");
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2 text-sm font-medium text-white transition hover:from-emerald-600 hover:to-teal-700"
            >
              Aplicar filtros
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-[30px] bg-white/85 p-6">
        <h2 className="font-display text-2xl">Totales semanales</h2>
        <p className="mt-1 text-sm text-foreground/50">
          Semanas de lunes a domingo dentro del rango consultado.
        </p>
        <div className="mt-4 overflow-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[720px]">
            <thead className="bg-white">
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="py-3 pl-4 font-medium">Semana</th>
                <th className="py-3 font-medium text-right">Entradas</th>
                <th className="py-3 font-medium text-right">Salidas</th>
                <th className="py-3 font-medium text-right">Ventas</th>
                <th className="py-3 font-medium text-right">Gastos</th>
                <th className="py-3 pr-4 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(initialSummary?.weeks.length ?? 0) > 0 ? (
                initialSummary?.weeks.map((week) => (
                  <tr key={week.start} className="border-b border-foreground/5">
                    <td className="py-3 pl-4 text-sm">
                      {shortDate(week.start)} — {shortDate(week.end)}
                    </td>
                    <td className="py-3 text-right text-sm text-emerald-600">
                      {money(week.entries)}
                    </td>
                    <td className="py-3 text-right text-sm text-red-600">
                      {money(week.exits)}
                    </td>
                    <td className="py-3 text-right text-sm text-foreground/60">
                      {money(week.sales)}
                    </td>
                    <td className="py-3 text-right text-sm text-foreground/60">
                      {money(week.expenses)}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right text-sm font-semibold ${
                        week.balance >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {money(week.balance)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-foreground/50"
                  >
                    Sin movimientos en el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[30px] bg-white/85 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Movimientos</h2>
          <p className="text-sm text-foreground/50">
            {initialList.total} registros
          </p>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[820px]">
            <thead className="bg-white">
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="py-3 pl-4 font-medium">Fecha</th>
                <th className="py-3 font-medium">Descripción</th>
                <th className="py-3 font-medium">Categoría</th>
                <th className="py-3 font-medium text-right">Monto</th>
                <th className="py-3 pr-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((record) => (
                  <tr
                    key={`${record.source}-${record.id}`}
                    className="border-b border-foreground/5"
                  >
                    <td className="py-3 pl-4 text-sm text-foreground/60">
                      {shortDate(record.recordDate)}
                    </td>
                    <td className="py-3 text-sm">
                      <span className="font-medium">{record.description}</span>
                      {record.supplier && (
                        <span className="block text-xs text-slate-400">
                          {record.supplier}
                        </span>
                      )}
                      {record.employeeName && (
                        <span className="block text-xs text-slate-400">
                          {record.employeeName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          record.direction === "ENTRY"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {CATEGORY_LABELS[record.category] ?? record.category}
                      </span>
                    </td>
                    <td
                      className={`py-3 text-right text-sm font-semibold ${
                        record.direction === "ENTRY"
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {record.direction === "ENTRY" ? "+" : "−"}
                      {money(record.amount)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <FinanceRowActions
                        record={record}
                        employees={employees}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-foreground/50"
                  >
                    No hay registros financieros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => pushQuery(initialList.page - 1)}
              disabled={initialList.page <= 1}
              className="rounded-xl border border-foreground/10 px-4 py-2 transition hover:bg-foreground/5 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-foreground/50">
              Página {initialList.page} de {totalPages} · {initialList.total}{" "}
              registros
            </span>
            <button
              type="button"
              onClick={() => pushQuery(initialList.page + 1)}
              disabled={initialList.page >= totalPages}
              className="rounded-xl border border-foreground/10 px-4 py-2 transition hover:bg-foreground/5 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "red" | "blue" | "amber";
}) {
  const tones = {
    emerald: "from-emerald-500/10 to-emerald-500/5 text-emerald-600",
    red: "from-red-500/10 to-red-500/5 text-red-600",
    blue: "from-blue-500/10 to-blue-500/5 text-blue-600",
    amber: "from-amber-500/10 to-amber-500/5 text-amber-600",
  } as const;

  return (
    <div className={`rounded-[26px] bg-gradient-to-br p-5 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
