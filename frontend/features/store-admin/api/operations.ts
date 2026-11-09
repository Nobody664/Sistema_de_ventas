import type { OrderView } from "@/components/store/store-orders";

export type AdminOrderDetail = OrderView;
export interface AdminOrderRow {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfillment: string;
  totalAmount: string;
  createdAt: string;
  version: number;
  refundRequestedAt: string | null;
  customer: { name: string | null; email: string | null };
}
export interface OrderPage {
  data: AdminOrderRow[];
  pageInfo: { nextCursor: string | null; hasMore: boolean };
  totals: { matched: number };
  appliedFilters: Record<string, string>;
  asOf: string;
}
export const queues = [
  { key: "review", label: "Por revisar" },
  { key: "prepare", label: "Por preparar" },
  { key: "preparing", label: "En preparación" },
  { key: "pickup", label: "Listos para retirar" },
  { key: "shipping", label: "En camino" },
] as const;

interface NotificationSnapshot {
  isConnected: boolean;
  notifications: Array<{
    id: string;
    companyId?: string | null;
    actionUrl?: string | null;
  }>;
}
export function shouldReconcileCommerce(
  current: NotificationSnapshot,
  previous: NotificationSnapshot,
  companyId: string,
): boolean {
  if (current.isConnected && !previous.isConnected) return true;
  const ids = new Set(previous.notifications.map((notice) => notice.id));
  return current.notifications.some(
    (notice) =>
      !ids.has(notice.id) &&
      notice.companyId === companyId &&
      (notice.actionUrl === "/store" ||
        notice.actionUrl?.startsWith("/comercio/")),
  );
}

export const commandLabels: Record<string, string> = {
  APPROVE_PAYMENT: "Registrar cobro confirmado",
  REJECT_PROOF: "Solicitar corrección",
  PREPARE: "Preparar pedido",
  READY: "Listo para retirar",
  SHIP: "Registrar despacho",
  DELIVER: "Confirmar entrega",
  EXTEND: "Extender reserva",
  CANCEL: "Cancelar pedido impago",
  REFUND: "Devolver pago completo",
  RESTOCK: "Registrar retorno físico",
};

export function orderCommandBody(
  action: string,
  version: number,
  reference: string,
): { body?: Record<string, unknown>; error?: string } {
  const text = reference.trim();
  if (text.length > 240 || /[<>\u0000-\u001f\u007f]/.test(text))
    return { error: "Usa una referencia válida de hasta 240 caracteres." };
  if ((action === "APPROVE_PAYMENT" || action === "REFUND") && text.length < 5)
    return {
      error:
        "Indica la referencia real del cobro o devolución (mínimo 5 caracteres).",
    };
  if (action === "SHIP" && !text)
    return { error: "Indica la referencia de seguimiento del envío." };
  return {
    body:
      action === "REFUND"
        ? { version, reference: text }
        : { action, version, ...(text ? { reference: text } : {}) },
  };
}

export function orderListResource(
  params: URLSearchParams,
  area: "pedidos" | "pagos" | "entregas",
): string {
  const query = new URLSearchParams({ limit: "30" });
  for (const key of [
    "q",
    "status",
    "paymentStatus",
    "fulfillment",
    "queue",
    "shippingKind",
    "cursor",
  ]) {
    const value = params.get(key);
    if (value && value !== "all") query.set(key, value);
  }
  if (
    area === "pagos" &&
    !params.has("queue") &&
    !query.has("paymentStatus") &&
    !query.has("status")
  )
    query.set("queue", "review");
  return `orders?${query}`;
}

export function orderQueueResource(
  params: URLSearchParams,
  queue: (typeof queues)[number]["key"],
): string {
  const query = new URLSearchParams(
    orderListResource(params, "pedidos").split("?")[1],
  );
  query.delete("cursor");
  query.set("queue", queue);
  query.set("limit", "10");
  return `orders?${query}`;
}
