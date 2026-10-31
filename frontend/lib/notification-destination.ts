import type { Notification } from "@/types/api";
import { safeRedirect } from "./safe-redirect";

const routes: Record<string, string> = {
  NEW_COMPANY_REGISTRATION: "/platform/companies",
  CHECKOUT_REQUEST_PENDING: "/platform/upgrade-requests",
  PLAN_UPGRADE_REQUEST: "/platform/upgrade-requests",
  PAYMENT_PROOF_PENDING: "/platform/upgrade-requests",
  PAYMENT_RECEIVED: "/subscription",
  PAYMENT_FAILED: "/subscription",
  ACCOUNT_APPROVED: "/dashboard",
  ACCOUNT_ACTIVATED: "/dashboard",
  SUBSCRIPTION_APPROVED: "/subscription",
  SUBSCRIPTION_REJECTED: "/subscription",
  SUBSCRIPTION_PENDING: "/subscription",
  TRIAL_EXPIRING_SOON: "/subscription",
  TRIAL_EXPIRED: "/subscription",
  PLAN_UPGRADED: "/subscription",
  NEW_SALE: "/sales",
  LOW_STOCK: "/products",
  PRODUCT_EXPIRING_SOON: "/products",
  PRODUCT_EXPIRED: "/products",
  NEW_CUSTOMER: "/customers",
  SALE_COMPLETED: "/sales",
  SALE_RETURNED: "/sales",
  GENERAL: "/notifications",
};

export function notificationDestination(
  notification: Pick<Notification, "type" | "data" | "actionUrl" | "scope">,
  platform = false,
): string {
  if (
    ["LOW_STOCK", "PRODUCT_EXPIRING_SOON", "PRODUCT_EXPIRED"].includes(
      notification.type,
    ) &&
    notification.scope !== "PLATFORM"
  ) {
    const data = notification.data;
    const productId =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>).productId
        : undefined;
    if (
      typeof productId === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(productId)
    )
      return `/products/${encodeURIComponent(productId)}`;
  }
  if (notification.actionUrl) {
    const destination = safeRedirect(notification.actionUrl);
    if (destination !== "/dashboard" || notification.actionUrl === "/dashboard")
      return destination;
  }
  return (
    routes[notification.type] ??
    (platform ? "/platform/notifications" : "/notifications")
  );
}
