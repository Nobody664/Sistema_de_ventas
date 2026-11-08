"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  PackageX,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import {
  batchDateLabel,
  batchStateLabel,
  type ExpiryBatch,
  type ExpiryBatchList,
  type BatchWriteOffResult,
} from "@/lib/batch-expiry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const units: Record<string, string> = {
  UNIT: "und",
  KG: "kg",
  LT: "lt",
  MT: "mt",
};

export function ExpiredBatchesClient({
  initial,
  initialProductId,
  canViewFinance,
}: {
  initial: ExpiryBatchList;
  initialProductId: string;
  canViewFinance: boolean;
}) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState(initialProductId);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<ExpiryBatch | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchWriteOffResult | null>(null);
  const submitting = useRef(false);
  const queryClient = useQueryClient();
  const money = (value: string | number) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: data.currency,
    }).format(Number(value));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      status,
      page: String(page),
      limit: "20",
      ...(query ? { search: query } : {}),
      ...(productId ? { productId } : {}),
    });
    void apiFetch<ExpiryBatchList>(`/batch-expiry?${params}`, {
      signal: controller.signal,
    })
      .then((list) => {
        if (!controller.signal.aborted) setData(list);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los lotes",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, query, productId, page, revision]);
  const open = (batch: ExpiryBatch) => {
    setSelected(batch);
    setReason(
      batch.daysLeft < 0
        ? "Baja por vencimiento del lote"
        : "Baja anticipada por cercanía al vencimiento",
    );
    setActionError("");
    setNotice("");
  };
  const confirm = async () => {
    if (!selected || submitting.current) return;
    if (reason.trim().length < 5 || /[<>\u0000-\u001f\u007f]/.test(reason)) {
      setActionError("Indica un motivo válido de al menos 5 caracteres.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setActionError("");
    try {
      const written = await apiFetch<BatchWriteOffResult>(
        `/batch-expiry/${encodeURIComponent(selected.id)}/write-off`,
        {
          method: "POST",
          timeoutMs: 60000,
          body: JSON.stringify({
            expectedUpdatedAt: selected.updatedAt,
            expectedQuantityAvailable: selected.quantityAvailable,
            expectedPurchasePrice: selected.purchasePrice,
            reason: reason.trim(),
          }),
        },
      );
      setResult(written);
      setSelected(null);
      for (const key of [
        "products",
        "inventory",
        "product-batches",
        "finance",
        "dashboard",
        "kardex",
      ])
        void queryClient.invalidateQueries({ queryKey: [key] });
      setRevision((value) => value + 1);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "No se pudo registrar la baja";
      if (cause instanceof ApiError && cause.status === 409) {
        setSelected(null);
        setNotice(message);
        setRevision((value) => value + 1);
      } else setActionError(message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-foreground/50">
            Operaciones · Control por lote
          </p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">
            Lotes de productos vencidos
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/60">
            Administra los lotes vencidos y los que vencen hoy o en los próximos
            3 días. Una baja solo afecta al lote elegido; los nuevos ingresos
            vigentes del mismo producto se conservan.
          </p>
          <p className="mt-2 text-xs text-foreground/50">
            Fecha del negocio: {batchDateLabel(data.today)} · {data.timezone}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading || busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw className="mr-2 size-4" />
          Actualizar
        </Button>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Lotes vencidos",
            value: data.counts.expired,
            icon: PackageX,
          },
          {
            title: "Vencen hoy / en 3 días",
            value: data.counts.expiring,
            icon: CalendarClock,
          },
          {
            title: "Inversión del saldo en esta página",
            value: money(
              data.data.reduce(
                (sum, batch) => sum + Number(batch.lossAmount),
                0,
              ),
            ),
            icon: AlertTriangle,
          },
        ].map(({ title, value, icon: Icon }) => (
          <Card key={title} className="rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              <Icon className="size-4" />
              {title}
            </div>
            <p className="mt-3 font-display text-3xl tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      {result && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-600/25 bg-emerald-600/10 p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-4" />
            Baja registrada: lote {result.batchNumber}
          </p>
          <p className="mt-2">
            {result.quantity} retirados · Pérdida:{" "}
            {new Intl.NumberFormat("es-PE", {
              style: "currency",
              currency: result.currency,
            }).format(Number(result.lossAmount))}
            . Los demás lotes permanecen sin cambios.
          </p>
          {canViewFinance && (
            <Link
              href="/finance"
              className="mt-2 inline-block font-semibold underline"
            >
              Ver pérdida en finanzas
            </Link>
          )}
        </div>
      )}
      {(error || notice) && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
        >
          {error || notice}
        </p>
      )}
      <Card className="min-w-0 rounded-2xl p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end gap-4">
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search.trim());
              setPage(1);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
              <Input
                aria-label="Buscar producto, SKU o lote"
                maxLength={160}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Producto, SKU o lote"
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
          <label className="grid gap-2 text-xs font-medium">
            Estado
            <select
              aria-label="Estado de vencimiento"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-foreground/15 bg-background px-3 text-sm"
            >
              <option value="ALL">Vencidos y próximos a vencer</option>
              <option value="EXPIRED">Solo vencidos</option>
              <option value="EXPIRING">Hoy y próximos 3 días</option>
            </select>
          </label>
          {productId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setProductId("");
                setPage(1);
              }}
            >
              Quitar filtro de producto
            </Button>
          )}
        </div>
        <p className="mb-4 text-xs text-foreground/55">
          La pérdida corresponde al saldo del lote × costo de compra por unidad
          base. No se vuelve a cargar la inversión de unidades ya vendidas. Los
          lotes reservados no pueden darse de baja.
        </p>
        {loading && (
          <p
            role="status"
            className="mb-3 flex items-center gap-2 text-sm text-foreground/60"
          >
            <Loader2 className="size-4 animate-spin" />
            Actualizando lotes…
          </p>
        )}
        <div
          className="overflow-x-auto rounded-xl border border-foreground/10"
          aria-busy={loading}
        >
          <table className="w-full min-w-[1020px] text-sm">
            <caption className="sr-only">
              Lotes vencidos o por vencer con saldo pendiente de baja
            </caption>
            <thead className="bg-muted/40 text-left text-xs text-foreground/60">
              <tr>
                {[
                  "Producto",
                  "Lote",
                  "Vencimiento",
                  "Estado",
                  "Saldo",
                  "Reservado",
                  "Costo base",
                  "Pérdida del saldo",
                  "Acción",
                ].map((title) => (
                  <th key={title} scope="col" className="px-3 py-4 font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {data.data.map((batch) => (
                <tr key={batch.id} className="align-top hover:bg-muted/20">
                  <td className="max-w-60 px-3 py-4">
                    <strong className="font-medium">
                      {batch.product.name}
                    </strong>
                    <p className="mt-1 text-xs text-foreground/50">
                      {batch.product.sku ?? "Sin SKU"}
                      {batch.branchName ? ` · ${batch.branchName}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <span className="font-mono text-xs">
                      {batch.batchNumber}
                    </span>
                    <p className="mt-1 max-w-40 break-all text-[10px] text-foreground/45">
                      ID: {batch.id}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">
                    {batchDateLabel(batch.expirationDate)}
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${batch.daysLeft < 0 ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}
                    >
                      {batchStateLabel(batch.daysLeft)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 tabular-nums">
                    {batch.quantityAvailable}{" "}
                    {units[batch.product.baseUnit] ?? batch.product.baseUnit}
                  </td>
                  <td className="px-3 py-4 tabular-nums">
                    {batch.reservedQuantity}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 tabular-nums">
                    {money(batch.purchasePrice)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 font-semibold tabular-nums">
                    {money(batch.lossAmount)}
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      variant="outline"
                      disabled={
                        busy || loading || Number(batch.reservedQuantity) > 0
                      }
                      aria-label={`Dar de baja lote ${batch.batchNumber}`}
                      onClick={() => open(batch)}
                    >
                      Dar de baja
                    </Button>
                    {Number(batch.reservedQuantity) > 0 && (
                      <p className="mt-1 text-xs text-foreground/50">
                        Resuelve sus reservas
                      </p>
                    )}
                  </td>
                </tr>
              ))}
              {!data.data.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-foreground/55"
                  >
                    No hay lotes con saldo dentro de este rango de vencimiento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-foreground/55">
            {data.total} lotes · Página {page} de {Math.max(1, data.totalPages)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading || busy || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={loading || busy || page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja el lote seleccionado</DialogTitle>
            <DialogDescription>
              Esta acción registra una salida de inventario y una pérdida
              financiera. No desactiva el producto ni otros lotes.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-foreground/10 bg-muted/25 p-4 text-sm">
                <p className="font-semibold">{selected.product.name}</p>
                <p className="mt-2">
                  Lote: <strong>{selected.batchNumber}</strong>
                </p>
                <p className="mt-1 break-all text-xs text-foreground/50">
                  {selected.id}
                </p>
                <p className="mt-2">
                  Vencimiento: {batchDateLabel(selected.expirationDate)}
                </p>
                <p className="mt-1">
                  Cantidad a retirar: {selected.quantityAvailable}{" "}
                  {units[selected.product.baseUnit] ??
                    selected.product.baseUnit}
                </p>
                <p className="mt-2 font-semibold">
                  Pérdida a registrar: {money(selected.lossAmount)}
                </p>
              </div>
              {selected.daysLeft >= 0 && (
                <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                  El lote aún no ha vencido. Estás decidiendo retirarlo
                  anticipadamente y registrar su inversión restante como
                  pérdida.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="batch-loss-reason">Motivo de la baja</Label>
                <Input
                  id="batch-loss-reason"
                  value={reason}
                  disabled={busy}
                  maxLength={240}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              {actionError && (
                <p
                  role="alert"
                  className="text-sm text-red-700 dark:text-red-300"
                >
                  {actionError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || reason.trim().length < 5}
              onClick={() => void confirm()}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar baja y pérdida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
