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
  REJECT_PROOF: "Rechazar comprobante",
  PREPARE: "Preparar pedido",
  READY: "Listo para retirar",
  SHIP: "Registrar despacho",
  DELIVER: "Confirmar entrega",
  EXTEND: "Extender reserva",
  CANCEL: "Cancelar / rechazar pedido impago",
  REFUND: "Devolver pago completo",
  RESTOCK: "Registrar retorno físico",
};

export const commandDescriptions: Record<string, string> = {
  APPROVE_PAYMENT:
    "Confirma un cobro verificado de transferencia, Yape, Plin o efectivo. Se informa al comprador si el pedido queda confirmado o si el pago requiere conciliación por una reserva vencida.",
  REJECT_PROOF:
    "Rechaza el comprobante sin registrar un cobro ni cancelar automáticamente el pedido. El motivo se comunica al comprador para que pueda corregirlo dentro de su reserva.",
  PREPARE:
    "Inicia la preparación de un pedido con venta confirmada, o un retiro en efectivo con reserva vigente. Se avisa al comprador.",
  READY:
    "Marca el pedido como listo para retirar y comunica al comprador la dirección del retiro.",
  SHIP: "Registra el despacho de un delivery y envía al comprador su referencia de seguimiento.",
  DELIVER:
    "Confirma la entrega de un pedido pagado y comunica que fue completado.",
  EXTEND:
    "Agrega tiempo a la reserva vigente, conserva el stock reservado y comunica el nuevo plazo al comprador.",
  CANCEL:
    "Cancela o rechaza un pedido impago, libera su reserva y comunica el motivo al comprador.",
  REFUND:
    "Devuelve un cobro confirmado. Para Mercado Pago se conserva la misma solicitud al reintentar y se informa si aún falta confirmar el resultado. No repone productos.",
  RESTOCK:
    "Registra el retorno físico de productos después de una devolución confirmada y avisa al comprador. No realiza otro reembolso.",
};

export function orderActionOptions(
  order: Pick<
    AdminOrderDetail,
    "allowedActions" | "paymentStatus" | "actionAvailability"
  >,
) {
  const enabled = new Set([
    ...(order.allowedActions ?? []),
    ...(order.paymentStatus === "PAID" ? ["REFUND"] : []),
  ]);
  return Object.keys(commandLabels).map(
    (action) =>
      order.actionAvailability?.find((item) => item.action === action) ?? {
        action,
        enabled: enabled.has(action),
        reason: enabled.has(action)
          ? null
          : "La acción no está disponible para el estado actual del pedido.",
      },
  );
}

export function orderActionFeedback(
  action: string,
  order: Pick<AdminOrderDetail, "status" | "saleId" | "paymentStatus">,
): string {
  if (
    action === "APPROVE_PAYMENT" &&
    (order.status === "REVIEW_REQUIRED" || !order.saleId)
  )
    return "Cobro registrado para conciliación; no se confirmó disponibilidad ni una venta. El comprador tiene un aviso sobre esta revisión.";
  if (action === "REFUND" && order.paymentStatus !== "REFUNDED")
    return "La solicitud de devolución está registrada, pero la pasarela aún no confirmó el reintegro. El comprador fue avisado del inicio de la solicitud; revisa el estado antes de reintentar.";
  const text: Record<string, string> = {
    APPROVE_PAYMENT: "Cobro confirmado y pedido aceptado.",
    REJECT_PROOF: "Comprobante rechazado y motivo comunicado.",
    PREPARE: "Pedido en preparación.",
    READY: "Pedido listo para retirar y dirección comunicada.",
    SHIP: "Despacho y seguimiento registrados.",
    DELIVER: "Entrega confirmada.",
    EXTEND: "Reserva ampliada y nuevo plazo comunicado.",
    CANCEL: "Pedido cancelado y reserva liberada.",
    REFUND:
      "Devolución del pago confirmada; el retorno físico se gestiona por separado.",
    RESTOCK: "Retorno físico registrado, sin repetir la devolución del dinero.",
  };
  return `${text[action] ?? "Pedido actualizado."} El aviso del pedido está disponible para el comprador.`;
}

export function orderCommandBody(
  action: string,
  version: number,
  reference: string,
  reason = "",
): { body?: Record<string, unknown>; error?: string } {
  if (!(action in commandLabels) || !Number.isInteger(version) || version < 1)
    return { error: "Selecciona una acción válida y actualiza el pedido." };
  const needsReference = ["APPROVE_PAYMENT", "REFUND", "SHIP"].includes(action);
  const text = needsReference ? reference.trim() : "";
  if (text.length > 240 || /[<>\u0000-\u001f\u007f]/.test(text))
    return { error: "Usa una referencia válida de hasta 240 caracteres." };
  if ((action === "APPROVE_PAYMENT" || action === "REFUND") && text.length < 5)
    return {
      error:
        "Indica la referencia real del cobro o devolución (mínimo 5 caracteres).",
    };
  if (action === "SHIP" && !text)
    return { error: "Indica la referencia de seguimiento del envío." };
  const motive = reason.trim();
  if (
    ["REJECT_PROOF", "CANCEL"].includes(action) &&
    (motive.length < 5 ||
      motive.length > 500 ||
      /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(motive))
  )
    return {
      error:
        "Indica un motivo para el comprador de entre 5 y 500 caracteres, sin etiquetas.",
    };
  return {
    body:
      action === "REFUND"
        ? { version, reference: text }
        : {
            action,
            version,
            ...(text ? { reference: text } : {}),
            ...(["REJECT_PROOF", "CANCEL"].includes(action)
              ? { reason: motive }
              : {}),
          },
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
