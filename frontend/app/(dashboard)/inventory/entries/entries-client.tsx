"use client";

import { printHtml } from "@/lib/print-html";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { StockEntryProducts } from "@/components/products/stock-entry-products";
import {
  stockEntryLineError,
  type StockEntryLine as Line,
} from "@/lib/stock-entry-reception";
import {
  ArrowLeft,
  FileText,
  Loader2,
  PackagePlus,
  Printer,
  Receipt,
  Store,
} from "lucide-react";
import Link from "next/link";
import type {
  DistributorPurchaseSummary,
  PurchaseReceiptDetail,
  PurchaseReceiptRecord,
  StockEntryDistributorOption,
  StockEntryProductOption,
  StockEntrySupplierOption,
} from "./page";

const UNIT_SHORT: Record<string, string> = {
  UNIT: "und",
  KG: "kg",
  LT: "lt",
  MT: "mt",
};

interface EntryItem {
  id: string;
  productId: string;
  presentationId: string | null;
  quantity: string;
  baseQuantity: string;
  unitCost: string;
  unitCostPresentation: string;
  expiryDate: string | null;
  batchNumber?: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    description: string | null;
    baseUnit: string;
  };
  presentation?: { id: string; name: string; factor: string } | null;
}

interface EntryRecord {
  id: string;
  reference: string | null;
  notes: string | null;
  entryDate: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  distributor?: { id: string; name: string; code: string } | null;
  supplier?: { id: string; name: string; code: string | null } | null;
  items: EntryItem[];
}

interface StockEntriesClientProps {
  initialEntries: Array<Record<string, unknown>>;
  products: StockEntryProductOption[];
  branches: Array<{ id: string; name: string }>;
  distributors: StockEntryDistributorOption[];
  suppliers: StockEntrySupplierOption[];
  purchases: DistributorPurchaseSummary[];
  receipts: PurchaseReceiptRecord[];
}

export function StockEntriesClient({
  initialEntries,
  products,
  branches,
  distributors,
  suppliers,
  purchases,
  receipts,
}: StockEntriesClientProps) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);

  const entries = initialEntries as unknown as EntryRecord[];
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const [lines, setLines] = useState<Line[]>([]);
  const [editorVersion, setEditorVersion] = useState(0);
  const [hasPendingProduct, setHasPendingProduct] = useState(false);
  const submittingRef = useRef(false);
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [issuingKey, setIssuingKey] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [entryDate, setEntryDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalInvestment = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity) || 0;
    const unitCost = Number(line.unitCost) || 0;
    const amount = quantity * unitCost;
    return (
      sum +
      (Number.isFinite(amount) && quantity > 0 && unitCost >= 0 ? amount : 0)
    );
  }, 0);

  const historyInvestment = entries.reduce(
    (sum, entry) =>
      sum +
      entry.items.reduce(
        (s, item) => s + Number(item.unitCost) * Number(item.quantity),
        0,
      ),
    0,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    if (hasPendingProduct) {
      setError(
        "Agrega el producto seleccionado a la tabla o limpia la selección antes de registrar.",
      );
      return;
    }
    if (!lines.length) {
      setError("Agrega al menos un producto a la recepción.");
      return;
    }
    const invalidIndex = lines.findIndex((line) =>
      stockEntryLineError(line, productMap.get(line.productId)),
    );
    if (invalidIndex >= 0) {
      setError(
        `Revisa la fila ${invalidIndex + 1}: ${stockEntryLineError(lines[invalidIndex], productMap.get(lines[invalidIndex].productId))}`,
      );
      return;
    }
    const items = lines.map((line) => ({
      productId: line.productId,
      presentationId: line.presentationId || undefined,
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost),
      expiryDate: line.expiryDate ? `${line.expiryDate}T00:00:00` : undefined,
      batchNumber: line.batchNumber.trim() || undefined,
    }));

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await apiFetch("/stock-entries", {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({
          branchId: branchId || undefined,
          supplierId: supplierId || undefined,
          reference: reference || undefined,
          notes: notes || undefined,
          entryDate: entryDate
            ? new Date(`${entryDate}T00:00:00`).toISOString()
            : undefined,
          items,
        }),
      });

      addToast("Entrada de stock registrada correctamente", "success");
      setLines([]);
      setHasPendingProduct(false);
      setEditorVersion((current) => current + 1);
      setReference("");
      setNotes("");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo registrar la entrada.";
      setError(message);
      addToast(message, "error");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const printReceipt = (receipt: PurchaseReceiptDetail) => {
    const title = receipt.supplier
      ? `${receipt.supplier.name}${receipt.supplier.code ? ` (${receipt.supplier.code})` : ""}`
      : receipt.distributor
        ? `${receipt.distributor.name} (${receipt.distributor.code})`
        : "General / sin proveedor";

    const rows = receipt.entries
      .flatMap((entry) =>
        entry.items.map((item) => {
          const productName = item.presentation
            ? `${item.product.name} (${item.presentation.name})`
            : item.product.name;
          const productCell = item.product.description
            ? `${escapeHtml(productName)}<br><span style="font-size:11px;color:#64748b">${escapeHtml(item.product.description)}</span>`
            : escapeHtml(productName);
          const lineTotal = Number(item.unitCost) * Number(item.quantity);
          return `<tr><td>${new Date(entry.entryDate).toLocaleDateString()}</td><td>${escapeHtml(entry.reference ?? "—")}</td><td>${productCell}</td><td style="text-align:right">${Number(item.quantity)}</td><td style="text-align:right">S/ ${Number(item.unitCost).toFixed(2)}</td><td style="text-align:right">S/ ${lineTotal.toFixed(2)}</td></tr>`;
        }),
      )
      .join("");

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Boleta interna ${escapeHtml(receipt.fullNumber)}</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;padding:32px;color:#0f172a}
  h1{font-size:20px;margin:0 0 4px}
  p{margin:2px 0;color:#475569;font-size:13px}
  .folio{font-size:22px;font-weight:700;letter-spacing:.05em}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
  th,td{border-bottom:1px solid #e2e8f0;padding:8px}
  th{background:#f8fafc;text-transform:uppercase;font-size:11px;letter-spacing:.08em;color:#64748b;text-align:left}
  .total{margin-top:20px;font-size:16px;font-weight:700;color:#0f172a}
  .brand{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#10b981}
</style></head><body>
  <p class="brand">Boleta interna de compras</p>
  <h1>BOLETA INTERNA DE COMPRA</h1>
  <p class="folio">${escapeHtml(receipt.fullNumber)}</p>
  <p>Proveedor: <strong>${escapeHtml(title)}</strong></p>
  <p>Entradas: ${receipt.entryCount} · Artículos: ${receipt.itemCount}</p>
  <p>Emitida: ${new Date(receipt.issuedAt).toLocaleString()}</p>
  <table><thead><tr><th>Fecha</th><th>Referencia</th><th>Producto</th><th style="text-align:right">Cant.</th><th style="text-align:right">Costo</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="total">Total comprado: S/ ${receipt.totalAmount.toFixed(2)}</p>
</body></html>`;

    void printHtml(html).catch((error: unknown) => {
      addToast(
        error instanceof Error
          ? error.message
          : "No se pudo imprimir la boleta",
        "error",
      );
    });
  };

  const issueReceipt = async (group: DistributorPurchaseSummary) => {
    const key = group.supplier?.id ?? group.distributor?.id ?? "general";
    setIssuingKey(key);
    try {
      const detail = await apiFetch<PurchaseReceiptDetail>(
        "/stock-entries/receipts",
        {
          method: "POST",
          token: getAccessToken(),
          body: JSON.stringify({
            supplierId: group.supplier?.id ?? undefined,
            distributorId: group.distributor?.id ?? undefined,
          }),
        },
      );
      addToast(`Boleta ${detail.fullNumber} emitida`, "success");
      printReceipt(detail);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo emitir la boleta.";
      addToast(message, "error");
    } finally {
      setIssuingKey(null);
    }
  };

  const reprintReceipt = async (receipt: PurchaseReceiptRecord) => {
    try {
      const detail = await apiFetch<PurchaseReceiptDetail>(
        `/stock-entries/receipts/${receipt.id}`,
        {
          token: getAccessToken(),
        },
      );
      printReceipt(detail);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo cargar la boleta.";
      addToast(message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/inventory"
          className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a inventario
        </Link>
      </div>

      <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-700 p-6 sm:p-8 text-white animate-fade-in-up">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              Inventario
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl sm:leading-none">
              Registrar entrada
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Ingresa mercadería al almacén por unidad o presentación. El kardex
              y el costo se actualizan automáticamente.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-sm">
            <PackagePlus className="size-8 text-emerald-200" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/50">
                Entradas registradas
              </p>
              <p className="font-display text-2xl">{entries.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-100">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-6"
          aria-busy={submitting}
          onChange={() => setError(null)}
        >
          <fieldset disabled={submitting} className="min-w-0 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label
                  htmlFor="stock-entry-date"
                  className="text-sm font-semibold text-slate-700"
                >
                  Fecha de ingreso
                </Label>
                <Input
                  id="stock-entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="stock-entry-branch"
                  className="text-sm font-semibold text-slate-700"
                >
                  Sucursal
                </Label>
                <select
                  id="stock-entry-branch"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="">Sin sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="stock-entry-supplier"
                  className="text-sm font-semibold text-slate-700"
                >
                  Proveedor
                </Label>
                <select
                  id="stock-entry-supplier"
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="">General (sin proveedor)</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="stock-entry-reference"
                  className="text-sm font-semibold text-slate-700"
                >
                  Referencia
                </Label>
                <Input
                  id="stock-entry-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Factura, guía, proveedor..."
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="stock-entry-notes"
                  className="text-sm font-semibold text-slate-700"
                >
                  Notas
                </Label>
                <Input
                  id="stock-entry-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observaciones"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <StockEntryProducts
              key={editorVersion}
              products={products}
              lines={lines}
              onChange={setLines}
              onPendingChange={setHasPendingProduct}
              disabled={submitting}
            />

            {hasPendingProduct && (
              <p className="text-sm text-foreground/60">
                Hay un producto seleccionado pendiente de agregar. Agrégalo a la
                tabla o limpia la selección para registrar.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex flex-col items-stretch justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
                  Inversión total
                </p>
                <p className="font-display text-2xl text-slate-900">
                  S/ {totalInvestment.toFixed(2)}
                </p>
              </div>
              <Button
                type="submit"
                disabled={submitting || !lines.length || hasPendingProduct}
                className="h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Registrar entrada
                  </>
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
              Historial
            </p>
            <h2 className="mt-2 font-display text-2xl">Entradas de stock</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
              Inversión acumulada
            </p>
            <p className="font-display text-xl text-slate-900">
              S/ {historyInvestment.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[1080px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="pb-4 pl-4 font-medium">Fecha</th>
                <th className="pb-4 font-medium">Referencia</th>
                <th className="pb-4 font-medium">Sucursal</th>
                <th className="pb-4 font-medium">Proveedor</th>
                <th className="pb-4 font-medium">Producto</th>
                <th className="pb-4 font-medium text-right">Cantidad</th>
                <th className="pb-4 font-medium text-center">Vencimiento</th>
                <th className="pb-4 font-medium text-right">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {entries.length > 0 ? (
                entries.map((entry) =>
                  entry.items.map((item, itemIndex) => (
                    <tr
                      key={`${entry.id}-${item.id}`}
                      className="border-b border-foreground/5 table-row-hover"
                    >
                      {itemIndex === 0 && (
                        <>
                          <td
                            className="py-3 pl-4 text-sm text-foreground/60"
                            rowSpan={entry.items.length}
                          >
                            {new Date(
                              entry.entryDate ?? entry.createdAt,
                            ).toLocaleDateString()}
                          </td>
                          <td
                            className="py-3 text-sm"
                            rowSpan={entry.items.length}
                          >
                            {entry.reference ?? "—"}
                          </td>
                          <td
                            className="py-3 text-sm text-foreground/60"
                            rowSpan={entry.items.length}
                          >
                            {entry.branch?.name ?? "—"}
                          </td>
                          <td
                            className="py-3 text-sm text-foreground/60"
                            rowSpan={entry.items.length}
                          >
                            {entry.supplier?.name ??
                              entry.distributor?.name ??
                              "General"}
                          </td>
                        </>
                      )}
                      <td className="py-3 text-sm font-medium">
                        {item.product.name}
                        {item.batchNumber && (
                          <span className="block text-xs font-normal text-emerald-700">
                            Lote: {item.batchNumber}
                          </span>
                        )}
                        {item.presentation ? (
                          <span className="ml-1 text-xs text-slate-400">
                            ({item.presentation.name})
                          </span>
                        ) : null}
                        {item.product.description && (
                          <span className="block text-xs font-normal text-slate-400">
                            {item.product.description}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-sm">
                        {Number(item.quantity)} {unitLabel(item, productMap)}
                        <span className="block text-xs text-slate-400">
                          {Number(item.baseQuantity).toFixed(3)}{" "}
                          {UNIT_SHORT[item.product.baseUnit] ??
                            item.product.baseUnit}
                        </span>
                      </td>
                      <td className="py-3 text-center text-sm text-foreground/60">
                        {item.expiryDate
                          ? new Date(item.expiryDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right text-sm font-medium">
                        S/{" "}
                        {(
                          Number(item.unitCost) * Number(item.quantity)
                        ).toFixed(2)}
                      </td>
                    </tr>
                  )),
                )
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-foreground/50"
                  >
                    Aún no hay entradas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
              Compras por proveedor
            </p>
            <h2 className="mt-2 font-display text-2xl">Boletas internas</h2>
          </div>
        </div>

        {purchases.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {purchases.map((group) => (
              <div
                key={group.supplier?.id ?? group.distributor?.id ?? "general"}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    {group.supplier || group.distributor ? (
                      <Store className="size-5" />
                    ) : (
                      <PackagePlus className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {group.supplier?.name ??
                        group.distributor?.name ??
                        "General (sin proveedor)"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {group.supplier?.code
                        ? `Código ${group.supplier.code}`
                        : group.distributor
                          ? `Código ${group.distributor.code}`
                          : "Compras sin proveedor"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Total comprado
                    </p>
                    <p className="font-display text-lg text-slate-900">
                      S/ {group.totalPurchased.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Pendiente
                    </p>
                    <p
                      className={`font-display text-lg ${group.pendingCount > 0 ? "text-amber-600" : "text-slate-900"}`}
                    >
                      S/ {group.pendingTotal.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Entradas
                    </p>
                    <p className="font-display text-lg text-slate-900">
                      {group.entryCount}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {group.itemCount} artículos · {group.pendingCount} sin boletar
                  {group.lastEntryDate
                    ? ` · Última: ${new Date(group.lastEntryDate).toLocaleDateString()}`
                    : ""}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    group.pendingCount === 0 ||
                    issuingKey ===
                      (group.supplier?.id ?? group.distributor?.id ?? "general")
                  }
                  onClick={() => issueReceipt(group)}
                  className="mt-4 h-10 w-full rounded-xl border-slate-200 text-slate-700 hover:bg-white hover:border-emerald-300 disabled:opacity-60"
                >
                  {issuingKey ===
                  (group.supplier?.id ?? group.distributor?.id ?? "general") ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Emitiendo...
                    </>
                  ) : (
                    <>
                      <Printer className="mr-2 h-4 w-4" />
                      {group.pendingCount > 0
                        ? "Emitir boleta interna"
                        : "Sin compras pendientes"}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            <Receipt className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            Aún no hay compras registradas por proveedor.
          </div>
        )}
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
              Documentos
            </p>
            <h2 className="mt-2 font-display text-2xl">Boletas emitidas</h2>
          </div>
        </div>

        {receipts.length > 0 ? (
          <div className="overflow-auto rounded-xl border border-foreground/10">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                  <th className="py-3 pl-4 font-medium">Folio</th>
                  <th className="py-3 font-medium">Proveedor</th>
                  <th className="py-3 font-medium">Emitida</th>
                  <th className="py-3 text-right font-medium">Entradas</th>
                  <th className="py-3 text-right font-medium">Total</th>
                  <th className="py-3 pr-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className="border-b border-foreground/5 table-row-hover"
                  >
                    <td className="py-3 pl-4 text-sm font-semibold text-slate-900">
                      {receipt.fullNumber}
                    </td>
                    <td className="py-3 text-sm text-foreground/70">
                      {receipt.supplier
                        ? `${receipt.supplier.name}${receipt.supplier.code ? ` (${receipt.supplier.code})` : ""}`
                        : receipt.distributor
                          ? `${receipt.distributor.name} (${receipt.distributor.code})`
                          : "General"}
                    </td>
                    <td className="py-3 text-sm text-foreground/60">
                      {new Date(receipt.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right text-sm">
                      {receipt.entryCount}
                    </td>
                    <td className="py-3 text-right text-sm font-medium">
                      S/ {receipt.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => reprintReceipt(receipt)}
                        className="h-9 rounded-lg text-slate-600 hover:bg-slate-100"
                      >
                        <Printer className="mr-1.5 h-4 w-4" />
                        Reimprimir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            Aún no se han emitido boletas internas.
          </div>
        )}
      </Card>
    </div>
  );
}

function unitLabel(
  item: EntryItem,
  productMap: Map<string, StockEntryProductOption>,
): string {
  if (item.presentation) return item.presentation.name;
  const product = productMap.get(item.productId);
  return product ? (UNIT_SHORT[product.baseUnit] ?? product.baseUnit) : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] as string;
  });
}
