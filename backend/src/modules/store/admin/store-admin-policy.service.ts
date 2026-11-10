import { BadRequestException, Injectable } from "@nestjs/common";
import { CompanyStatus, StoreOrder } from "@prisma/client";
import { storeSnapshotSchema } from "../store-pricing";

export type StoreAdminMode = "MANAGE" | "CLOSEOUT";

export type StoreOrderActionName =
  | "APPROVE_PAYMENT"
  | "REJECT_PROOF"
  | "PREPARE"
  | "READY"
  | "SHIP"
  | "DELIVER"
  | "CANCEL"
  | "EXTEND"
  | "RESTOCK";

export interface StoreAdminCapabilities {
  viewDashboard: boolean;
  manageOrders: boolean;
  managePayments: boolean;
  manageCatalog: boolean;
  manageCustomers: boolean;
  manageSettings: boolean;
  managePaymentsConfig: boolean;
  manageShippingConfig: boolean;
  manageRules: boolean;
  attendExistingOrders: boolean;
}

export interface StoreAdminContext {
  experience?: {
    enabled: boolean;
    eligible: boolean;
    reason: string | null;
    telemetry?: boolean;
  };
  extensions?: { appearance: boolean; notes: boolean; savedViews: boolean };
  mode: StoreAdminMode;
  company: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    status: CompanyStatus;
  };
  store: {
    title: string;
    slug: string;
    enabled: boolean;
    checkoutEnabled: boolean;
  };
  capabilities: StoreAdminCapabilities;
  access: {
    attendExistingOrders: boolean;
  };
  generatedAt: string;
}

type OrderForActions = Pick<
  StoreOrder,
  | "status"
  | "paymentStatus"
  | "fulfillment"
  | "saleId"
  | "expiresAt"
  | "snapshot"
> & {
  refund?: { status: string; restockedAt: Date | null } | null;
  reservations?: Array<{ state: string; expiresAt: Date }>;
};

export interface StoreOrderActionAvailability {
  action: StoreOrderActionName | "REFUND";
  enabled: boolean;
  reason: string | null;
}

@Injectable()
export class StoreAdminPolicyService {
  mode(input: {
    companyStatus: CompanyStatus;
    storefrontModule: boolean;
  }): StoreAdminMode {
    const activeCompany =
      input.companyStatus === CompanyStatus.ACTIVE ||
      input.companyStatus === CompanyStatus.TRIAL;
    return activeCompany && input.storefrontModule ? "MANAGE" : "CLOSEOUT";
  }

  capabilities(mode: StoreAdminMode): StoreAdminCapabilities {
    const manage = mode === "MANAGE";
    return {
      viewDashboard: manage,
      manageOrders: manage,
      managePayments: manage,
      manageCatalog: manage,
      manageCustomers: manage,
      manageSettings: manage,
      managePaymentsConfig: manage,
      manageShippingConfig: manage,
      manageRules: manage,
      attendExistingOrders: true,
    };
  }

  allowedActions(
    order: OrderForActions,
    now = new Date(),
  ): StoreOrderActionName[] {
    return this.actionAvailability(order, now)
      .filter(
        (
          item,
        ): item is StoreOrderActionAvailability & {
          action: StoreOrderActionName;
        } => item.enabled && item.action !== "REFUND",
      )
      .map((item) => item.action);
  }

  actionAvailability(
    order: OrderForActions,
    now = new Date(),
  ): StoreOrderActionAvailability[] {
    const actions: Array<StoreOrderActionName | "REFUND"> = [
      "APPROVE_PAYMENT",
      "REJECT_PROOF",
      "PREPARE",
      "READY",
      "SHIP",
      "DELIVER",
      "EXTEND",
      "CANCEL",
      "REFUND",
      "RESTOCK",
    ];
    const parsed = storeSnapshotSchema.safeParse(order.snapshot);
    if (!parsed.success)
      return actions.map((action) => ({
        action,
        enabled: false,
        reason:
          "La configuración original del pedido no es válida. Revisa el pedido antes de operar.",
      }));
    const snapshot = parsed.data;
    const paid = order.paymentStatus === "PAID";
    const refunded =
      order.paymentStatus === "REFUNDED" ||
      order.refund?.status === "SUCCEEDED";
    const hasSale = !!order.saleId;
    const open = ["PENDING_PAYMENT", "CONFIRMED"].includes(order.status);
    const closed = ["CANCELLED", "EXPIRED", "COMPLETED"].includes(order.status);
    const manual = ["TRANSFER", "YAPE", "PLIN", "CASH_ON_PICKUP"].includes(
      snapshot.payment.code,
    );
    const liveReservation =
      order.expiresAt > now &&
      (order.reservations === undefined ||
        (order.reservations.length > 0 &&
          order.reservations.every(
            (hold) => hold.state === "ACTIVE" && hold.expiresAt > now,
          )));
    const cash =
      snapshot.payment.code === "CASH_ON_PICKUP" &&
      snapshot.shipping.kind === "PICKUP" &&
      !paid &&
      !refunded &&
      !hasSale &&
      liveReservation;
    const refundPending = order.refund?.status === "PENDING";
    const fulfill = open && !refundPending && ((paid && hasSale) || cash);
    const consumed =
      order.reservations?.some((hold) => hold.state === "CONSUMED") ?? hasSale;
    const paymentReason = refunded
      ? "El cobro ya fue devuelto."
      : paid || hasSale
        ? "El cobro ya fue registrado; no se registra por segunda vez."
        : !manual
          ? "Mercado Pago confirma o rechaza el cobro automáticamente; no admite aprobación manual."
          : "El pedido ya está completado.";
    const fulfillmentReason = refundPending
      ? "La devolución está en proceso. Espera su confirmación antes de avanzar la entrega."
      : order.status === "REVIEW_REQUIRED" || (paid && !hasSale)
        ? hasSale
          ? "El pedido tiene una incidencia de pago pendiente de revisión; resuélvela antes de avanzar la entrega."
          : "El pago requiere conciliación y no tiene venta confirmada. No se puede preparar ni entregar como si hubiera stock confirmado."
        : !open
          ? "El pedido ya no admite avances de entrega."
          : !paid && !cash
            ? "Primero confirma el cobro. Solo el efectivo al retirar con reserva vigente puede prepararse sin pago previo."
            : "La acción no corresponde al estado o tipo de entrega actual.";
    const enabled: Record<StoreOrderActionName | "REFUND", boolean> = {
      APPROVE_PAYMENT:
        manual &&
        !paid &&
        !refunded &&
        !hasSale &&
        order.status !== "COMPLETED",
      REJECT_PROOF:
        manual &&
        snapshot.payment.code !== "CASH_ON_PICKUP" &&
        order.paymentStatus === "UNDER_REVIEW" &&
        !hasSale &&
        !refunded,
      PREPARE: fulfill && order.fulfillment === "UNFULFILLED",
      READY:
        fulfill &&
        order.fulfillment === "PREPARING" &&
        snapshot.shipping.kind === "PICKUP",
      SHIP:
        fulfill &&
        order.fulfillment === "PREPARING" &&
        snapshot.shipping.kind === "DELIVERY",
      DELIVER:
        fulfill &&
        paid &&
        hasSale &&
        ["READY_FOR_PICKUP", "SHIPPED"].includes(order.fulfillment),
      EXTEND: open && !paid && !refunded && !hasSale && liveReservation,
      CANCEL: !closed && !paid && !refunded && !hasSale,
      REFUND: paid && !refunded,
      RESTOCK:
        refunded &&
        order.refund?.status === "SUCCEEDED" &&
        !order.refund.restockedAt &&
        consumed,
    };
    return actions.map((action) => ({
      action,
      enabled: enabled[action],
      reason: enabled[action]
        ? null
        : action === "APPROVE_PAYMENT"
          ? paymentReason
          : action === "REJECT_PROOF"
            ? "Solo se rechaza un comprobante manual pendiente de revisión, sin cobro confirmado."
            : action === "EXTEND"
              ? "Solo se amplía una reserva vigente de un pedido impago con stock reservado."
              : action === "CANCEL"
                ? "Solo se cancela un pedido abierto e impago. Un cobro confirmado requiere devolución."
                : action === "REFUND"
                  ? "La devolución requiere un cobro confirmado y todavía no devuelto."
                  : action === "RESTOCK"
                    ? "Requiere una devolución confirmada y productos consumidos pendientes de retorno físico."
                    : fulfillmentReason,
    }));
  }

  assertAllowedAction(
    order: OrderForActions,
    action: StoreOrderActionName | "REFUND",
    now = new Date(),
  ): void {
    const availability = this.actionAvailability(order, now).find(
      (item) => item.action === action,
    );
    if (!availability?.enabled)
      throw new BadRequestException(
        availability?.reason ?? "Acción no disponible para este pedido",
      );
  }
}
