"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { storeApi } from "@/lib/store-api";
import { createStoreCheckoutKey } from "@/lib/store-checkout";
import type { StoreCart } from "@/lib/store-cart";
import type { StoreQuoteView } from "./store-commerce";

export function StoreConfirm({
  slug,
  quote,
  onMessage,
  onCartChange,
  onBusyChange,
}: {
  slug: string;
  quote: StoreQuoteView;
  onMessage: (text: string) => void;
  onCartChange: (cart: StoreCart) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const pending = useRef(false);
  const key = useRef<{ quote: string; key: string } | null>(null);
  const confirm = async () => {
    if (pending.current || orderId) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      if (key.current?.quote !== quote.id)
        key.current = { quote: quote.id, key: createStoreCheckoutKey() };
      const order = await storeApi<{ id: string }>(
        slug,
        "orders",
        { quoteId: quote.id, idempotencyKey: key.current.key },
        "POST",
        { timeoutMs: 120000 },
      );
      if (
        !order ||
        typeof order.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(order.id)
      )
        throw new Error(
          "No se pudo comprobar la confirmación. Reintenta para recuperar tu pedido.",
        );
      setOrderId(order.id);
      onMessage(
        "Pedido registrado. Puedes revisar su estado y completar el pago.",
      );
      void storeApi<StoreCart>(slug, "cart")
        .then(onCartChange)
        .catch(() => undefined);
      router.push(
        `/tienda/${encodeURIComponent(slug)}/pedidos/${encodeURIComponent(order.id)}`,
      );
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "No se pudo confirmar el pedido. Vuelve a intentarlo.";
      setError(message);
      onMessage(message);
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  return (
    <div aria-busy={busy} className="space-y-3">
      {orderId ? (
        <div role="status" className="rounded-xl bg-white/10 p-4">
          <p className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            Tu pedido quedó registrado.
          </p>
          <Link
            href={`/tienda/${encodeURIComponent(slug)}/pedidos/${encodeURIComponent(orderId)}`}
            className="font-semibold text-white underline"
          >
            Ver mi pedido
          </Link>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || new Date(quote.expiresAt) <= new Date()}
          className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-teal-950 disabled:opacity-50"
          onClick={() => void confirm()}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Confirmando…
            </span>
          ) : (
            "Confirmar pedido con este total"
          )}
        </button>
      )}
      {busy && (
        <p role="status" className="text-sm text-teal-100">
          Estamos registrando tu compra y reservando los productos. No necesitas
          volver a pulsar.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-white p-4 text-sm text-red-800 dark:text-red-200"
        >
          <p>{error}</p>
          <p className="mt-2">
            Tu carrito se conserva si no se registró la compra. Si se perdió la
            respuesta, reintentar esta confirmación recupera el mismo pedido.
          </p>
        </div>
      )}
    </div>
  );
}
