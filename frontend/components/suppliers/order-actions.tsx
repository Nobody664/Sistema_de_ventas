"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageCheck, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type { SupplierOrder, SupplierOrderStatus } from "@/types/suppliers";

export function OrderActions({ order }: { order: SupplierOrder }) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [busy, setBusy] = useState<string | null>(null);
  const [receiveMode, setReceiveMode] = useState(false);
  const [costs, setCosts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of order.items) {
      map[item.productId] = item.unitCost ?? 0;
    }
    return map;
  });

  const changeStatus = async (status: SupplierOrderStatus) => {
    setBusy(status);
    try {
      await apiFetch(`/suppliers/orders/${order.id}/status`, {
        method: "PATCH",
        token: getAccessToken(),
        body: JSON.stringify({ status }),
      });
      addToast("Estado actualizado", "success");
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(null);
    }
  };

  const receive = async () => {
    setBusy("receive");
    try {
      await apiFetch(`/suppliers/orders/${order.id}/receive`, {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({
          items: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.requestedQuantity,
            unitCost: costs[item.productId] ?? item.unitCost ?? 0,
          })),
        }),
      });
      addToast("Orden recibida y stock actualizado", "success");
      setReceiveMode(false);
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(null);
    }
  };

  const isTerminal =
    order.status === "CONFIRMED" || order.status === "CANCELLED";

  if (isTerminal) {
    return (
      <p className="rounded-2xl border border-foreground/10 bg-card p-5 text-sm text-foreground/50">
        Esta orden está{" "}
        {order.status === "CONFIRMED" ? "recibida" : "cancelada"} y no admite
        más acciones.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-foreground/10 bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
        Gestión de la orden
      </p>

      {order.status === "DRAFT" && (
        <Button
          type="button"
          onClick={() => changeStatus("SENT")}
          disabled={busy !== null}
          className="h-10 w-full rounded-xl"
          variant="outline"
        >
          {busy === "SENT" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          Marcar como enviada
        </Button>
      )}

      {(order.status === "DRAFT" || order.status === "SENT") && (
        <>
          {!receiveMode ? (
            <Button
              type="button"
              onClick={() => setReceiveMode(true)}
              className="h-10 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white"
            >
              <PackageCheck className="mr-2 size-4" />
              Recibir mercadería
            </Button>
          ) : (
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {item.product?.name ?? item.productId}
                  </span>
                  <label className="flex shrink-0 items-center gap-1 text-xs text-foreground/50">
                    Costo
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={costs[item.productId] ?? 0}
                      onChange={(e) =>
                        setCosts((prev) => ({
                          ...prev,
                          [item.productId]: Number(e.target.value),
                        }))
                      }
                      className="h-8 w-24 rounded-lg border border-input bg-background px-2 text-xs"
                    />
                  </label>
                </div>
              ))}
              <Button
                type="button"
                onClick={receive}
                disabled={busy !== null}
                className="h-10 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white"
              >
                {busy === "receive" && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Confirmar recepción
              </Button>
            </div>
          )}

          <Button
            type="button"
            onClick={() => changeStatus("CANCELLED")}
            disabled={busy !== null}
            variant="outline"
            className="h-10 w-full rounded-xl text-red-600"
          >
            {busy === "CANCELLED" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 size-4" />
            )}
            Cancelar orden
          </Button>
        </>
      )}
    </div>
  );
}
