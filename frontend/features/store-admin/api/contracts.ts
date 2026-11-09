export interface StoreAdminContext {
  experience?: {
    enabled: boolean;
    eligible: boolean;
    reason: string | null;
    telemetry?: boolean;
  };
  extensions?: { appearance: boolean; notes: boolean; savedViews: boolean };
  mode: "MANAGE" | "CLOSEOUT";
  company: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    status: string;
  };
  store: {
    title: string;
    slug: string;
    enabled: boolean;
    checkoutEnabled: boolean;
  };
  capabilities: {
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
  };
  access: { attendExistingOrders: boolean };
  generatedAt: string;
}

export interface StoreAdminDashboard {
  generatedAt: string;
  range: {
    fromKey: string;
    toKey: string;
    from: string;
    toExclusive: string;
    timezone: string;
  };
  metrics: {
    ordersCreated: {
      value: number;
      previous: number;
      changePercent: number | null;
    };
    onlineSales: {
      count: number;
      amount: string;
      previousCount: number;
      previousAmount: string;
      amountChangePercent: number | null;
    };
    paymentsToReview: { value: number };
    preparationPending: { value: number };
  };
  deliveriesPending: { total: number; pickups: number; shipments: number };
  trend: Array<{
    date: string;
    ordersCreated: number;
    onlineSalesCount: number;
    onlineSalesAmount: string;
  }>;
  health: { lastOrderAt: string | null };
}

export function storeAdminKeys(companyId: string, userId: string) {
  const scope = ["store-admin", companyId, userId] as const;
  return {
    all: scope,
    context: [...scope, "context"] as const,
    dashboard: (days: number) => [...scope, "dashboard", days] as const,
  };
}

export function commerceEntry(
  context: Pick<StoreAdminContext, "mode" | "experience">,
): string {
  if (context.experience?.enabled === false) return "/tienda-administracion";
  return context.mode === "MANAGE"
    ? "/comercio/resumen"
    : "/comercio/atencion/pedidos";
}

export function legacyCommerceRoute(pathname: string): string {
  const match =
    /^\/comercio\/(?:atencion\/)?pedidos\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(
      pathname,
    );
  return `/tienda-administracion${match ? `?pedido=${encodeURIComponent(match[1])}` : ""}`;
}

export function commerceAttentionRoute(pathname: string): string {
  const match = /^\/comercio\/pedidos\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(
    pathname,
  );
  return `/comercio/atencion/pedidos${match ? `/${match[1]}` : ""}`;
}
