import { Injectable } from "@nestjs/common";
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
};

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
    const actions: StoreOrderActionName[] = [];
    if (order.refund?.status === "SUCCEEDED" && !order.refund.restockedAt)
      actions.push("RESTOCK");

    if (
      order.status === "CANCELLED" ||
      order.status === "EXPIRED" ||
      order.status === "COMPLETED"
    )
      return actions;

    let snapshot: ReturnType<typeof storeSnapshotSchema.parse>;
    try {
      snapshot = storeSnapshotSchema.parse(order.snapshot);
    } catch {
      return actions;
    }

    if (order.paymentStatus === "UNDER_REVIEW") actions.push("REJECT_PROOF");

    const manualPayment = snapshot.payment.code !== "MERCADOPAGO";
    if (manualPayment && order.paymentStatus !== "PAID" && !order.saleId)
      actions.push("APPROVE_PAYMENT");

    if (
      !order.saleId &&
      order.paymentStatus !== "PAID" &&
      order.expiresAt > now
    )
      actions.push("EXTEND");

    const cash =
      snapshot.payment.code === "CASH_ON_PICKUP" && order.expiresAt > now;
    if (order.paymentStatus === "PAID" || cash) {
      if (order.fulfillment === "UNFULFILLED") actions.push("PREPARE");
      if (order.fulfillment === "PREPARING") {
        if (snapshot.shipping.kind === "PICKUP") actions.push("READY");
        if (snapshot.shipping.kind === "DELIVERY") actions.push("SHIP");
      }
      if (
        order.paymentStatus === "PAID" &&
        (order.fulfillment === "READY_FOR_PICKUP" ||
          order.fulfillment === "SHIPPED")
      )
        actions.push("DELIVER");
    }

    if (order.paymentStatus !== "PAID" && !order.saleId) actions.push("CANCEL");

    return actions;
  }
}
