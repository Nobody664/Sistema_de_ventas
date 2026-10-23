"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Pencil, Plus, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUiStore } from "@/store/ui-store";
import type {
  ApiProvider,
  PlatformApiSummary,
  PlatformAccount,
} from "@/types/platform-finance";
import {
  DataState,
  Field,
  fieldClass,
  Metric,
  money,
} from "./platform-data-ui";

export function PlatformApiUsageClient({ canManage }: { canManage: boolean }) {
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<"provider" | "record" | null>(null);
  const [provider, setProvider] = useState<ApiProvider | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const [accountId, setAccountId] = useState("");
  const cache = useQueryClient();
  const toast = useUiStore((state) => state.addToast);
  const summary = useQuery({
    queryKey: ["platform-api-usage", period],
    queryFn: () =>
      apiFetch<PlatformApiSummary>(
        `/platform/api-usage/summary?period=${period}`,
      ),
    enabled: /^\d{4}-(0[1-9]|1[0-2])$/.test(period),
  });
  const records = useQuery({
    queryKey: ["platform-api-usage", "records", recordPage],
    queryFn: () =>
      apiFetch<{
        items: {
          id: string;
          companyId: string;
          tokens: number;
          cost: number;
          currency: string;
          billed: boolean;
          occurredAt: string;
          provider: { name: string } | null;
        }[];
        totalPages: number;
      }>(`/platform/api-usage/records?page=${recordPage}`),
  });
  const accounts = useQuery({
    queryKey: ["platform-finance", "accounts"],
    queryFn: () => apiFetch<PlatformAccount[]>("/platform/finance/accounts"),
    enabled: canManage,
  });
  const bill = useMutation({
    mutationFn: (id: string) =>
      apiFetch("/platform/api-usage/records/bill", {
        method: "POST",
        body: JSON.stringify({ accountId, recordIds: [id] }),
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ["platform-api-usage"] });
      cache.invalidateQueries({ queryKey: ["platform-finance"] });
      toast("Consumo contabilizado como egreso", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });
  const save = useMutation({
    mutationFn: ({
      path,
      method,
      body,
    }: {
      path: string;
      method: string;
      body: Record<string, unknown>;
    }) =>
      apiFetch(`/platform/api-usage/${path}`, {
        method,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ["platform-api-usage"] });
      setEditor(null);
      toast("Cambios guardados", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    if (editor === "provider")
      save.mutate({
        path: provider ? `providers/${provider.id}` : "providers",
        method: provider ? "PATCH" : "POST",
        body: {
          ...values,
          costPerUnit: Number(values.costPerUnit),
          isActive: form.has("isActive"),
        },
      });
    else
      save.mutate({
        path: "records",
        method: "POST",
        body: {
          ...values,
          tokens: Number(values.tokens),
          occurredAt: new Date(String(values.occurredAt)).toISOString(),
        },
      });
  }
  const data = summary.data;
  const rows =
    data?.companies.filter((entry) =>
      entry.companyName.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const ledger = (
    <Card className="rounded-3xl p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Detalle de consumo</h2>
          <p className="mt-1 text-xs text-foreground/50">
            Todos los períodos. Contabilizar genera un egreso único por el costo
            del proveedor.
          </p>
        </div>
        {canManage && (
          <select
            className={fieldClass + " !w-auto"}
            aria-label="Cuenta para contabilizar"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Cuenta de pago…</option>
            {accounts.data
              ?.filter((entry) => entry.isActive)
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.currency})
                </option>
              ))}
          </select>
        )}
      </div>
      <DataState
        loading={records.isLoading}
        error={records.error}
        empty={!records.data?.items.length}
      >
        <div className="divide-y divide-foreground/10">
          {records.data?.items.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">
                  {entry.provider?.name ?? "Sin proveedor"} ·{" "}
                  {data?.companies.find(
                    (company) => company.companyId === entry.companyId,
                  )?.companyName ?? entry.companyId}
                </p>
                <p className="mt-1 text-xs text-foreground/50">
                  {new Date(entry.occurredAt).toLocaleDateString("es-PE")} ·{" "}
                  {entry.tokens.toLocaleString("es-PE")} tokens ·{" "}
                  {money(entry.cost, entry.currency)}
                </p>
              </div>
              {entry.billed ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Contabilizado
                </span>
              ) : canManage ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    bill.isPending ||
                    !accountId ||
                    entry.cost <= 0 ||
                    accounts.data?.find((account) => account.id === accountId)
                      ?.currency !== entry.currency
                  }
                  onClick={() => bill.mutate(entry.id)}
                >
                  Contabilizar egreso
                </Button>
              ) : (
                <span className="text-xs text-foreground/50">Pendiente</span>
              )}
            </div>
          ))}
        </div>
      </DataState>
      {(records.data?.totalPages ?? 0) > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            disabled={recordPage === 1}
            onClick={() => setRecordPage(recordPage - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs">
            {recordPage} / {records.data?.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={recordPage >= (records.data?.totalPages ?? 1)}
            onClick={() => setRecordPage(recordPage + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </Card>
  );
  return (
    <div className="space-y-7 animate-fade-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-foreground/10 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">
            Control de plataforma / APIs
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">
            Consumo bajo control.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-foreground/60">
            Cuotas por empresa, tokens registrados y costos por proveedor.
          </p>
        </div>
        <Field label="Período UTC">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={fieldClass}
            required
          />
        </Field>
      </header>
      <DataState loading={summary.isLoading} error={summary.error}>
        {data && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Solicitudes"
              value={data.totals.requests.toLocaleString("es-PE")}
              note="Contador de cuota mensual"
            />
            <Metric
              label="Tokens"
              value={data.totals.tokens.toLocaleString("es-PE")}
              note="Consumo detallado registrado"
            />
            <Metric
              label="Empresas con API"
              value={String(data.totals.enabledCompanies)}
              note={`De ${data.totals.companies} empresas`}
            />
            <Metric
              label="Proveedores"
              value={String(data.providerCatalog.length)}
              note="Costos separados por moneda"
            />
          </div>
        )}
      </DataState>
      <Card className="rounded-3xl p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Uso por empresa</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-foreground/40" />
            <input
              aria-label="Buscar empresa"
              placeholder="Buscar empresa…"
              className={fieldClass + " pl-9"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <DataState
          empty={!rows.length && !summary.isLoading}
          loading={summary.isLoading}
          error={summary.error}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs uppercase tracking-wider text-foreground/50">
                <tr>
                  <th className="pb-3">Empresa</th>
                  <th className="pb-3">Cuota mensual</th>
                  <th className="pb-3 text-right">Solicitudes</th>
                  <th className="pb-3 text-right">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {rows.map((entry) => (
                  <tr key={entry.companyId}>
                    <td className="py-4 pr-5">
                      <p className="font-medium">{entry.companyName}</p>
                      <p className="mt-1 text-xs text-foreground/50">
                        {entry.planName ?? "Sin plan"}
                        {!entry.apiEnabled && " · API deshabilitada"}
                      </p>
                    </td>
                    <td className="py-4 pr-5">
                      <div
                        className="h-1.5 w-36 overflow-hidden rounded-full bg-foreground/10"
                        role="progressbar"
                        aria-label={`Cuota de ${entry.companyName}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={entry.usagePercent}
                      >
                        <div
                          className={`h-full rounded-full ${entry.usagePercent >= 90 ? "bg-orange-500" : "bg-violet-500"}`}
                          style={{ width: `${entry.usagePercent}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-foreground/50">
                        {entry.quota.toLocaleString("es-PE")} incluidas
                      </p>
                    </td>
                    <td className="py-4 text-right tabular-nums">
                      {entry.requests.toLocaleString("es-PE")}
                    </td>
                    <td className="py-4 text-right tabular-nums">
                      {entry.tokens.toLocaleString("es-PE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Proveedores y costos</h2>
            <p className="mt-1 text-xs text-foreground/50">
              Los tokens requieren registros detallados; el contador de
              solicitudes ya existente continúa funcionando.
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={
                  !data?.providerCatalog.some((entry) => entry.isActive) ||
                  !data?.companies.length
                }
                onClick={() => setEditor("record")}
              >
                <Plus className="mr-1 size-4" />
                Registrar consumo
              </Button>
              <Button
                onClick={() => {
                  setProvider(null);
                  setEditor("provider");
                }}
              >
                <Plus className="mr-1 size-4" />
                Proveedor
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.providerCatalog.map((entry) => {
            const usage = data.providers.find(
              (row) => row.providerId === entry.id,
            );
            return (
              <Card key={entry.id} className="rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <Cpu className="size-5 text-violet-500" />
                  <h3 className="flex-1 font-medium">{entry.name}</h3>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Editar ${entry.name}`}
                      onClick={() => {
                        setProvider(entry);
                        setEditor("provider");
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-4 font-display text-3xl">
                  {money(usage?.cost ?? 0, entry.currency)}
                </p>
                <p className="mt-2 text-xs text-foreground/50">
                  {(usage?.tokens ?? 0).toLocaleString("es-PE")} {entry.unit} ·{" "}
                  {entry.isActive ? "Activo" : "Inactivo"}
                </p>
                <p className="mt-2 text-xs text-foreground/50">
                  Tarifa:{" "}
                  {entry.costPerUnit.toLocaleString("es-PE", {
                    maximumFractionDigits: 6,
                  })}{" "}
                  {entry.currency} / {entry.unit}
                </p>
              </Card>
            );
          })}
        </div>
        {!data?.providerCatalog.length && !summary.isLoading && (
          <p className="rounded-2xl border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/50">
            Agrega un proveedor para llevar el detalle de tokens y costos.
          </p>
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
            {editor === "provider"
              ? provider
                ? "Editar proveedor"
                : "Nuevo proveedor API"
              : "Registrar consumo"}
          </DialogTitle>
          <DialogDescription>
            {editor === "record"
              ? "Este registro incrementa una solicitud y los tokens de la empresa. El costo se calcula con la tarifa del proveedor."
              : "Configura la tarifa por unidad del proveedor."}
          </DialogDescription>
          <form onSubmit={submit} className="grid gap-4">
            {editor === "provider" ? (
              <>
                {!provider && (
                  <Field label="Identificador">
                    <input
                      name="slug"
                      required
                      minLength={2}
                      pattern="[a-z0-9-]+"
                      placeholder="proveedor-api"
                      className={fieldClass}
                    />
                  </Field>
                )}
                <Field label="Nombre">
                  <input
                    name="name"
                    required
                    minLength={2}
                    defaultValue={provider?.name}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Unidad">
                  <input
                    name="unit"
                    required
                    defaultValue={provider?.unit ?? "tokens"}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Costo por unidad">
                  <input
                    name="costPerUnit"
                    type="number"
                    min="0"
                    step="0.000001"
                    required
                    defaultValue={provider?.costPerUnit ?? 0}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Moneda">
                  <select
                    name="currency"
                    defaultValue={provider?.currency ?? "USD"}
                    className={fieldClass}
                  >
                    <option>USD</option>
                    <option>PEN</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={provider?.isActive ?? true}
                  />
                  Activo
                </label>
              </>
            ) : (
              <>
                <Field label="Empresa">
                  <select name="companyId" required className={fieldClass}>
                    {data?.companies.map((entry) => (
                      <option key={entry.companyId} value={entry.companyId}>
                        {entry.companyName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Proveedor">
                  <select name="providerId" required className={fieldClass}>
                    {data?.providerCatalog
                      .filter((entry) => entry.isActive)
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Tokens / unidades">
                  <input
                    name="tokens"
                    type="number"
                    min="0"
                    step="1"
                    required
                    className={fieldClass}
                  />
                </Field>
                <Field label="Fecha UTC">
                  <input
                    name="occurredAt"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Referencia">
                  <input
                    name="reference"
                    placeholder="ID externo o detalle de uso"
                    className={fieldClass}
                  />
                </Field>
              </>
            )}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {ledger}
    </div>
  );
}
