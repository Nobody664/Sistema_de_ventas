"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { storeApi } from "@/lib/store-api";
import { compressImage } from "@/lib/image-compression";
import { storeButton, storeInput, storeMoney } from "./store-ui";

export const orderLabels: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
  REVIEW_REQUIRED: "Requiere conciliación",
  COMPLETED: "Completado",
  PENDING: "Pendiente",
  UNDER_REVIEW: "En revisión",
  PAID: "Pagado",
  REFUNDED: "Devuelto",
  UNFULFILLED: "Por preparar",
  PREPARING: "En preparación",
  READY_FOR_PICKUP: "Listo para retirar",
  SHIPPED: "En camino",
  DELIVERED: "Entregado",
  SUCCEEDED: "Confirmada",
};
export interface OrderView {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfillment: string;
  version: number;
  totalAmount: string;
  expiresAt: string;
  createdAt: string;
  saleId?: string;
  trackingCode?: string;
  snapshot: {
    buyer: { firstName: string; lastName: string; documentValue: string };
    payment: { code: string; label: string; instructions: string };
    shipping: { kind: string; label: string; pickupAddress?: string };
    address?: {
      street: string;
      district: string;
      recipient: string;
      phone: string;
    } | null;
    lines: {
      name: string;
      quantity: string;
      totalPrice: string;
      presentationName?: string;
    }[];
    subtotal: string;
    shippingAmount: string;
    taxAmount: string;
    totalAmount: string;
  };
  history: { message: string; createdAt: string; version: number }[];
  proofs: { id: string; createdAt: string }[];
  refund?: { status: string; restockedAt: string | null } | null;
  refundRequestedAt?: string | null;
  refundReason?: string;
}

export function OrderSummary({ order }: { order: OrderView }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        {[order.status, order.paymentStatus, order.fulfillment].map((s) => (
          <span
            key={s}
            className="rounded-full bg-teal-50 px-3 py-2 text-teal-900"
          >
            {orderLabels[s] ?? s}
          </span>
        ))}
      </div>
      <div className="divide-y">
        {order.snapshot.lines.map((line, i) => (
          <div key={i} className="flex justify-between gap-4 py-3">
            <span>
              {line.name} {line.presentationName} × {line.quantity}
            </span>
            <span>{storeMoney(line.totalPrice)}</span>
          </div>
        ))}
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt>Productos sin impuestos</dt>
          <dd>{storeMoney(order.snapshot.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Envío sin impuestos</dt>
          <dd>{storeMoney(order.snapshot.shippingAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Impuestos</dt>
          <dd>{storeMoney(order.snapshot.taxAmount)}</dd>
        </div>
        <div className="flex justify-between border-t pt-3 text-xl font-semibold">
          <dt>Total</dt>
          <dd>{storeMoney(order.totalAmount)}</dd>
        </div>
      </dl>
      <div className="rounded-xl bg-stone-50 p-4 text-sm">
        <strong>{order.snapshot.shipping.label}</strong>
        <p className="mt-2">
          {order.snapshot.address
            ? `${order.snapshot.address.recipient}: ${order.snapshot.address.street}, ${order.snapshot.address.district} · ${order.snapshot.address.phone}`
            : order.snapshot.shipping.pickupAddress}
        </p>
        {order.trackingCode && (
          <p className="mt-2">Seguimiento: {order.trackingCode}</p>
        )}
      </div>
      <div className="rounded-xl border p-4 text-sm">
        <strong>{order.snapshot.payment.label}</strong>
        <p className="mt-2 whitespace-pre-wrap">
          {order.snapshot.payment.instructions}
        </p>
      </div>
      <ol className="space-y-3 border-l-2 border-teal-200 pl-5">
        {order.history.map((entry) => (
          <li key={entry.version}>
            <p className="text-sm">{entry.message}</p>
            <time className="text-xs text-stone-500">
              {new Date(entry.createdAt).toLocaleString("es-PE")}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StoreOrders({
  slug,
  id,
  onMessage,
}: {
  slug: string;
  id?: string;
  onMessage: (message: string) => void;
}) {
  const [orders, setOrders] = useState<
    Pick<
      OrderView,
      "id" | "number" | "status" | "paymentStatus" | "totalAmount"
    >[]
  >([]);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [notifications, setNotifications] = useState<
    { id: string; orderId: string; message: string; readAt: string | null }[]
  >([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      if (id) setOrder(await storeApi<OrderView>(slug, `orders/${id}`));
      else {
        setOrders(await storeApi<typeof orders>(slug, `orders?page=${page}`));
        setNotifications(
          await storeApi<typeof notifications>(slug, "me/notifications"),
        );
      }
    } catch (error) {
      onMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los pedidos",
      );
    }
  }, [slug, id, page, onMessage]);
  useEffect(() => {
    setOrder(null);
    void load();
  }, [load]);
  const operation = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      await storeApi(slug, path, body);
      setImage(null);
      await load();
      onMessage("Solicitud registrada");
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "No se pudo completar",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!id)
    return (
      <section>
        <div className="mb-6 flex justify-between">
          <h1 className="font-display text-3xl font-bold">Mis pedidos</h1>
          <button
            onClick={() => void load()}
            className="text-sm font-semibold text-teal-900"
          >
            Actualizar
          </button>
        </div>
        {notifications.some((n) => !n.readAt) && (
          <aside className="mb-6 space-y-2 rounded-2xl bg-white p-5">
            <h2 className="font-semibold">Novedades de tus compras</h2>
            {notifications
              .filter((n) => !n.readAt)
              .slice(0, 5)
              .map((n) => (
                <Link
                  key={n.id}
                  href={`/tienda/${slug}/pedidos/${n.orderId}`}
                  className="block text-sm text-teal-900"
                >
                  {n.message}
                </Link>
              ))}
            <button
              className="text-xs underline"
              onClick={() => void operation("me/notifications/read", {})}
            >
              Marcar avisos como leídos
            </button>
          </aside>
        )}
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/tienda/${slug}/pedidos/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"
            >
              <span>
                <strong>{o.number}</strong>
                <span className="mt-1 block text-sm text-stone-500">
                  {orderLabels[o.status]} · {orderLabels[o.paymentStatus]}
                </span>
              </span>
              <strong>{storeMoney(o.totalAmount)}</strong>
            </Link>
          ))}
        </div>
        {!orders.length && (
          <p className="py-8 text-stone-500">
            Todavía no tienes pedidos en esta página.
          </p>
        )}
        <div className="mt-6 flex gap-4">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>{page}</span>
          <button
            disabled={orders.length < 30}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
    );
  if (!order) return <p role="status">Cargando pedido…</p>;
  const unpaid =
    !["PAID", "REFUNDED"].includes(order.paymentStatus) &&
    !["CANCELLED", "EXPIRED"].includes(order.status);
  return (
    <section className="mx-auto max-w-3xl">
      <Link href={`/tienda/${slug}/pedidos`} className="text-sm text-teal-900">
        ← Mis pedidos
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{order.number}</h1>
        <button onClick={() => void load()} className="text-sm text-teal-900">
          Actualizar estado
        </button>
      </div>
      <article className="rounded-3xl border bg-white p-6 sm:p-8">
        <OrderSummary order={order} />
      </article>
      {unpaid && (
        <div className="mt-6 space-y-5 rounded-2xl border bg-white p-6">
          <p className="text-sm text-stone-600">
            Plazo de reserva:{" "}
            {new Date(order.expiresAt).toLocaleString("es-PE")}. El comprobante
            se revisa antes de confirmar el pago.
          </p>
          {order.snapshot.payment.code === "MERCADOPAGO" ? (
            <button
              disabled={busy}
              className={storeButton}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await storeApi<{
                    redirectUrl: string | null;
                    message: string;
                  }>(slug, `orders/${id}/payments`, {});
                  if (result.redirectUrl)
                    window.location.assign(result.redirectUrl);
                  else onMessage(result.message);
                } catch (error) {
                  onMessage(
                    error instanceof Error
                      ? error.message
                      : "No se pudo iniciar el pago",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Continuar en Mercado Pago
            </button>
          ) : (
            order.snapshot.payment.code !== "CASH_ON_PICKUP" && (
              <form
                className="space-y-4"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  if (image)
                    void operation(`orders/${id}/payment-proofs`, { image });
                }}
              >
                <label className="block text-sm font-semibold">
                  Comprobante de pago
                  <input
                    className={`${storeInput} mt-2`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      try {
                        setImage(
                          await compressImage(file, { format: "image/webp" }),
                        );
                      } catch (error) {
                        onMessage(
                          error instanceof Error
                            ? error.message
                            : "No se pudo preparar la imagen",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <button disabled={busy || !image} className={storeButton}>
                  Enviar comprobante
                </button>
              </form>
            )
          )}
          <button
            disabled={busy}
            className="text-sm text-red-700"
            onClick={() => void operation(`orders/${id}/cancel`, {})}
          >
            Cancelar pedido y liberar reserva
          </button>
        </div>
      )}
      {order.paymentStatus === "PAID" && !order.refundRequestedAt && (
        <form
          className="mt-6 space-y-3 rounded-2xl border bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void operation(`orders/${id}/refund-request`, {
              reason: data.get("reason"),
            });
          }}
        >
          <h2 className="font-semibold">Solicitar devolución</h2>
          <textarea
            name="reason"
            className={storeInput}
            minLength={5}
            maxLength={500}
            required
            placeholder="Cuéntanos el motivo"
          />
          <button disabled={busy} className={storeButton}>
            Enviar solicitud al negocio
          </button>
        </form>
      )}
      {order.refundRequestedAt && (
        <p className="mt-5 text-sm text-stone-600">
          El negocio recibió tu solicitud de devolución.
        </p>
      )}
    </section>
  );
}
