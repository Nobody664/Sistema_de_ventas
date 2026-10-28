"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageCheck, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { purchaseDecimal } from "@/lib/purchase-order";
import { useUiStore } from "@/store/ui-store";
import { usePermissions } from "@/hooks/usePermissions";
import type { SupplierOrder, SupplierOrderStatus } from "@/types/suppliers";

export function OrderActions({
  order: initialOrder,
}: {
  order: SupplierOrder;
}) {
  const [order, setOrder] = useState(initialOrder);
  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);
  const router = useRouter();
  const cache = useQueryClient();
  const toast = useUiStore((state) => state.addToast);
  const { hasPermission } = usePermissions();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"receive" | "cancel" | null>(null);
  const [reference, setReference] = useState(order.reference ?? "");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      order.items.map((item) => [
        item.productId,
        item.unitCost === null ? "" : String(item.unitCost),
      ]),
    ),
  );

  const run = async (
    key: string,
    operation: () => Promise<SupplierOrder>,
    message: string,
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(key);
    setError(null);
    try {
      const updated = await operation();
      setOrder(updated);
      await Promise.all(
        ["products", "inventory", "purchase-orders", "suppliers", "kardex"].map(
          (queryKey) => cache.invalidateQueries({ queryKey: [queryKey] }),
        ),
      );
      toast(message, "success");
      setMode(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la operación",
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };
  const changeStatus = (status: SupplierOrderStatus) =>
    run(
      status,
      () =>
        apiFetch<SupplierOrder>(`/suppliers/orders/${order.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status,
            reason:
              status === "CANCELLED" ? reason.trim() || undefined : undefined,
          }),
        }),
      status === "CANCELLED" ? "Orden cancelada" : "Orden marcada como enviada",
    );
  const receive = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const items = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.requestedQuantity,
        unitCost: purchaseDecimal(
          costs[item.productId] ?? "",
          4,
          0,
          99999999.9999,
          `Costo de ${item.product?.name ?? item.productId}`,
        ),
      }));
      void run(
        "receive",
        () =>
          apiFetch<SupplierOrder>(`/suppliers/orders/${order.id}/receive`, {
            method: "POST",
            body: JSON.stringify({
              reference: reference.trim() || undefined,
              notes: notes.trim() || undefined,
              items,
            }),
          }),
        "Orden recibida y entrada de inventario registrada",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Confirma los costos unitarios",
      );
    }
  };

  if (order.status === "CONFIRMED" || order.status === "CANCELLED")
    return (
      <div
        role="status"
        className="space-y-2 rounded-2xl border bg-card p-5 text-sm"
      >
        <p className="font-semibold">
          {order.status === "CANCELLED"
            ? "Orden cancelada"
            : order.stockEntryId && order.receivedAt
              ? "Recepción completada"
              : "Orden histórica confirmada"}
        </p>
        <p className="text-muted-foreground">
          {order.status === "CANCELLED"
            ? "No se ingresó mercadería por esta orden."
            : order.stockEntryId && order.receivedAt
              ? "La mercadería y sus costos ya fueron registrados. Esta orden no se puede recibir otra vez."
              : "Esta orden requiere conciliación antes de asociar una entrada. No se ingresará stock nuevamente."}
        </p>
      </div>
    );
  if (!hasPermission("supplier_order:manage")) return null;

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">Gestionar orden</h2>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 p-3 text-sm text-red-600"
        >
          {error}
        </p>
      )}
      {!mode && (
        <>
          {order.status === "DRAFT" && (
            <div>
              <Button
                type="button"
                onClick={() => void changeStatus("SENT")}
                disabled={!!busy}
                variant="outline"
                className="w-full rounded-xl"
              >
                {busy === "SENT" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Marcar como enviada
              </Button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Registra que compartiste la orden con el proveedor. No envía
                mensajes automáticamente.
              </p>
            </div>
          )}
          <Button
            type="button"
            onClick={() => {
              setMode("receive");
              setError(null);
            }}
            disabled={!!busy}
            className="w-full rounded-xl"
          >
            <PackageCheck className="size-4" />
            Recibir mercadería
          </Button>
          <Button
            type="button"
            onClick={() => {
              setMode("cancel");
              setError(null);
            }}
            disabled={!!busy}
            variant="outline"
            className="w-full rounded-xl text-red-600"
          >
            <XCircle className="size-4" />
            Cancelar orden
          </Button>
        </>
      )}
      {mode === "receive" && (
        <form onSubmit={receive} className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Confirma la recepción completa y los costos. El pedido no admite
            recepciones parciales; esta operación crea la entrada y actualiza
            stock y kardex en una sola transacción.
          </p>
          <fieldset disabled={!!busy} className="space-y-3">
            {order.items.map((item) => (
              <label
                key={item.id}
                className="block rounded-xl border p-3 text-sm"
              >
                <span className="block font-medium">
                  {item.product?.name ?? item.productId}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Recibir: {item.requestedQuantity} {item.product?.baseUnit} ·
                  costo por unidad base
                </span>
                <span className="mt-2 block text-xs">Costo unitario (S/)</span>
                <input
                  aria-label={`Costo recibido de ${item.product?.name ?? item.productId}`}
                  type="number"
                  min="0"
                  max="99999999.9999"
                  step="0.0001"
                  required
                  value={costs[item.productId] ?? ""}
                  onChange={(event) =>
                    setCosts((current) => ({
                      ...current,
                      [item.productId]: event.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
                />
              </label>
            ))}
            <label className="block text-sm">
              Referencia de recepción
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={60}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Notas de recepción
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                rows={2}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
              />
            </label>
          </fieldset>
          <Button type="submit" disabled={!!busy} className="w-full rounded-xl">
            {busy === "receive" && <Loader2 className="size-4 animate-spin" />}
            Confirmar recepción
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() => setMode(null)}
            className="w-full rounded-xl"
          >
            Volver
          </Button>
        </form>
      )}
      {mode === "cancel" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La orden quedará finalizada sin aumentar inventario.
          </p>
          <label className="block text-sm">
            Motivo (opcional)
            <textarea
              maxLength={500}
              value={reason}
              disabled={!!busy}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
          </label>
          <Button
            type="button"
            disabled={!!busy}
            variant="destructive"
            onClick={() => void changeStatus("CANCELLED")}
            className="w-full rounded-xl"
          >
            {busy === "CANCELLED" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Confirmar cancelación
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() => setMode(null)}
            className="w-full rounded-xl"
          >
            Volver
          </Button>
        </div>
      )}
    </div>
  );
}
