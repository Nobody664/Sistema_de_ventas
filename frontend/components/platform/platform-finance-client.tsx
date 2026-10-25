"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  businessDateInputValue,
  businessDateToInstant,
  formatBusinessDate,
} from "@/lib/business-date";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUiStore } from "@/store/ui-store";
import type {
  PlatformAccount,
  PlatformCompanyRevenue,
  PlatformFinanceSummary,
  PlatformTransaction,
} from "@/types/platform-finance";
import {
  DataState,
  Field,
  fieldClass,
  Metric,
  money,
} from "./platform-data-ui";

export function PlatformFinanceClient() {
  const cache = useQueryClient();
  const toast = useUiStore((state) => state.addToast);
  const [currency, setCurrency] = useState("PEN");
  const [tab, setTab] = useState("transactions");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<"account" | "transaction" | null>(null);
  const [account, setAccount] = useState<PlatformAccount | null>(null);
  const [transaction, setTransaction] = useState<PlatformTransaction | null>(
    null,
  );
  const summary = useQuery({
    queryKey: ["platform-finance", "summary", currency],
    queryFn: () =>
      apiFetch<PlatformFinanceSummary>(
        `/platform/finance/summary?currency=${currency}`,
      ),
  });
  const transactions = useQuery({
    queryKey: ["platform-finance", "transactions", page, type],
    queryFn: () =>
      apiFetch<{
        items: PlatformTransaction[];
        totalPages: number;
        total: number;
      }>(
        `/platform/finance/transactions?page=${page}${type ? `&type=${type}` : ""}`,
      ),
    enabled: tab === "transactions",
  });
  const companies = useQuery({
    queryKey: ["platform-finance", "companies"],
    queryFn: () =>
      apiFetch<PlatformCompanyRevenue[]>("/platform/finance/companies"),
    enabled: tab === "companies",
  });
  const save = useMutation({
    mutationFn: ({
      path,
      method,
      body,
    }: {
      path: string;
      method: string;
      body?: Record<string, unknown>;
    }) =>
      apiFetch(`/platform/finance/${path}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ["platform-finance"] });
      setEditor(null);
      toast("Cambios guardados", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    if (editor === "account") {
      save.mutate({
        path: account ? `accounts/${account.id}` : "accounts",
        method: account ? "PATCH" : "POST",
        body: {
          ...values,
          initialBalance: Number(values.initialBalance),
          isActive: form.has("isActive"),
        },
      });
    } else {
      save.mutate({
        path: transaction ? `transactions/${transaction.id}` : "transactions",
        method: transaction ? "PATCH" : "POST",
        body: {
          ...values,
          amount: Number(values.amount),
          occurredAt: businessDateToInstant(String(values.occurredAt)),
        },
      });
    }
  }

  const accounts = summary.data?.accounts ?? [];
  const totals = summary.data?.totals;
  const max = Math.max(
    1,
    ...(summary.data?.monthly.flatMap((month) => [
      month.income,
      month.expense,
    ]) ?? []),
  );

  return (
    <div className="space-y-7 animate-fade-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-foreground/10 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">
            Control de plataforma / Finanzas
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">
            Cada movimiento, en orden.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-foreground/60">
            Ingresos de suscripciones y tesorería de la plataforma. Resumen del
            mes actual (período UTC). Las fechas de movimientos se muestran en
            Lima (UTC−05:00).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Moneda del resumen"
            className={fieldClass + " !w-auto"}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>PEN</option>
            <option>USD</option>
          </select>
          <Button
            disabled={!accounts.some((entry) => entry.isActive)}
            onClick={() => {
              setTransaction(null);
              setEditor("transaction");
            }}
          >
            <Plus className="mr-2 size-4" />
            Movimiento
          </Button>
        </div>
      </header>
      <DataState loading={summary.isLoading} error={summary.error}>
        {totals && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Suscripciones"
              value={money(totals.subscriptionRevenue, currency)}
              note={`${totals.payments} pagos confirmados`}
            />
            <Metric
              label="Ingresos manuales"
              value={money(totals.manualIncome, currency)}
              note="Registrados en cuentas de plataforma"
            />
            <Metric
              label="Egresos"
              value={money(totals.totalExpense, currency)}
              note="Compras, APIs y operación"
            />
            <Metric
              label="Resultado del mes"
              value={money(totals.net, currency)}
              note="Suscripciones + ingresos manuales − egresos"
            />
          </div>
        )}
      </DataState>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">
              Pulso de los últimos 6 meses
            </h2>
            <span className="text-xs text-foreground/50">{currency}</span>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-foreground/60">
            <span>🟢 Ingresos</span>
            <span>🟠 Egresos</span>
          </div>
          <div className="mt-7 grid grid-cols-6 items-end gap-2">
            {summary.data?.monthly.map((month) => (
              <div key={month.month} className="min-w-0 text-center">
                <div
                  className="flex h-36 items-end justify-center gap-1"
                  role="img"
                  aria-label={`${month.month}: ingresos ${money(month.income, currency)}, egresos ${money(month.expense, currency)}`}
                >
                  <div
                    className="w-5 rounded-t-md bg-emerald-500/80 transition-all"
                    style={{
                      height: `${Math.max(1, (month.income / max) * 100)}%`,
                    }}
                  />
                  <div
                    className="w-5 rounded-t-md bg-orange-400/80 transition-all"
                    style={{
                      height: `${Math.max(1, (month.expense / max) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-[10px] text-foreground/60 sm:text-xs">
                  {month.month}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl">Cuentas de plataforma</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAccount(null);
                setEditor("account");
              }}
            >
              <Plus className="mr-1 size-4" />
              Cuenta
            </Button>
          </div>
          <p className="mt-2 text-xs text-foreground/50">
            Saldo inicial + movimientos manuales. Los pagos de suscripción se
            muestran por separado.
          </p>
          <div className="mt-4 max-h-60 space-y-2 overflow-auto">
            {accounts.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-foreground/10 p-3"
              >
                <Wallet className="size-4 shrink-0 text-violet-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.name}
                    {!entry.isActive && " · Inactiva"}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {money(entry.balance, entry.currency)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar ${entry.name}`}
                  onClick={() => {
                    setAccount(entry);
                    setEditor("account");
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            ))}
            {!accounts.length && (
              <p className="py-5 text-sm text-foreground/50">
                Crea tu primera cuenta para registrar ingresos y egresos.
              </p>
            )}
          </div>
        </Card>
      </div>
      <section className="rounded-3xl border border-foreground/10 bg-card p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {[
              ["transactions", "Movimientos"],
              ["companies", "Pagos por empresa"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant={tab === key ? "default" : "ghost"}
                onClick={() => setTab(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          {tab === "transactions" && (
            <select
              aria-label="Tipo de movimiento"
              className={fieldClass + " !w-auto"}
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los tipos</option>
              <option value="INCOME">Ingresos</option>
              <option value="EXPENSE">Egresos</option>
            </select>
          )}
        </div>
        {tab === "transactions" ? (
          <DataState
            loading={transactions.isLoading}
            error={transactions.error}
            empty={!transactions.data?.items.length}
          >
            <div className="divide-y divide-foreground/10">
              {transactions.data?.items.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 py-4"
                >
                  <div
                    className={`rounded-full p-2 ${entry.type === "INCOME" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-orange-500/10 text-orange-600 dark:text-orange-400"}`}
                  >
                    {entry.type === "INCOME" ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">
                      {entry.description}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {entry.account.name} · {entry.category} ·{" "}
                      {formatBusinessDate(entry.occurredAt)}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">
                    {entry.type === "EXPENSE" ? "−" : "+"}
                    {money(entry.amount, entry.currency)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Editar ${entry.description}`}
                    onClick={() => {
                      setTransaction(entry);
                      setEditor("transaction");
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Eliminar ${entry.description}`}
                    disabled={save.isPending}
                    onClick={() => {
                      if (window.confirm("¿Eliminar este movimiento?"))
                        save.mutate({
                          path: `transactions/${entry.id}`,
                          method: "DELETE",
                        });
                    }}
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </DataState>
        ) : (
          <DataState
            loading={companies.isLoading}
            error={companies.error}
            empty={!companies.data?.length}
          >
            <p className="mb-4 text-xs text-foreground/50">
              Pagos confirmados del mes en PEN. Hasta 100 empresas recientes.
            </p>
            <div className="divide-y divide-foreground/10">
              {companies.data?.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.name}</p>
                    <p className="text-xs text-foreground/50">
                      {entry.planName ?? "Sin plan"} ·{" "}
                      {entry.subscriptionStatus ?? "Sin suscripción"}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {money(entry.monthRevenue)}
                  </span>
                </div>
              ))}
            </div>
          </DataState>
        )}
        {tab === "transactions" && (transactions.data?.totalPages ?? 0) > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm">
              {page} / {transactions.data?.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page >= (transactions.data?.totalPages ?? 1)}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </section>
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {editor === "account"
              ? account
                ? "Editar cuenta"
                : "Nueva cuenta"
              : transaction
                ? "Editar movimiento"
                : "Nuevo movimiento"}
          </DialogTitle>
          <DialogDescription>
            Contabilidad interna de la plataforma.
          </DialogDescription>
          <form onSubmit={submit} className="grid gap-4">
            {editor === "account" ? (
              <>
                <Field label="Nombre">
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={account?.name}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    name="type"
                    defaultValue={account?.type ?? "CASH"}
                    className={fieldClass}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="BANK">Banco</option>
                    <option value="DIGITAL_WALLET">Billetera digital</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </Field>
                <Field label="Moneda">
                  <select
                    name="currency"
                    defaultValue={account?.currency ?? "PEN"}
                    className={fieldClass}
                  >
                    <option>PEN</option>
                    <option>USD</option>
                  </select>
                </Field>
                <Field label="Saldo inicial">
                  <input
                    name="initialBalance"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={account?.initialBalance ?? 0}
                    className={fieldClass}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={account?.isActive ?? true}
                  />
                  Cuenta activa
                </label>
              </>
            ) : (
              <>
                <Field label="Cuenta">
                  <select
                    name="accountId"
                    required
                    defaultValue={transaction?.accountId}
                    className={fieldClass}
                  >
                    {accounts
                      .filter(
                        (entry) =>
                          entry.isActive || entry.id === transaction?.accountId,
                      )
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} ({entry.currency})
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select
                    name="type"
                    defaultValue={transaction?.type ?? "EXPENSE"}
                    className={fieldClass}
                  >
                    <option value="INCOME">Ingreso</option>
                    <option value="EXPENSE">Egreso</option>
                  </select>
                </Field>
                <Field label="Descripción">
                  <input
                    name="description"
                    required
                    minLength={2}
                    maxLength={255}
                    defaultValue={transaction?.description}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Categoría">
                  <input
                    name="category"
                    required
                    defaultValue={transaction?.category ?? "GENERAL"}
                    placeholder="APIs, Hosting, Operación…"
                    className={fieldClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monto">
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      defaultValue={transaction?.amount}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Fecha contable · Lima (UTC−05:00)">
                    <input
                      name="occurredAt"
                      type="date"
                      required
                      defaultValue={businessDateInputValue(
                        transaction?.occurredAt,
                      )}
                      className={fieldClass}
                    />
                  </Field>
                </div>
              </>
            )}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
