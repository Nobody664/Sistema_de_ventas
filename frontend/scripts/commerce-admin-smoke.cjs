const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const { runOrderReviewChecks } = require("./store-order-review-checks.cjs");

const origin = "http://127.0.0.1:3324";
const backendOrigin = "http://127.0.0.1:4414";
let mode = "MANAGE";
let roles = ["COMPANY_ADMIN"];
let failDashboard = false;
let failEvents = false;
let failSave = false;
let conflictOnce = true;
const features = {
  appearance: false,
  notes: false,
  savedViews: false,
  version: 0,
};
const experience = {
  enabled: true,
  eligible: true,
  reason: null,
  version: 0,
  telemetry: true,
};
const appearance = {
  draft: {
    schemaVersion: 1,
    themePreset: "petroleo-crema",
    headline: "Encuentra tu próximo favorito.",
    heroDescription: "Explora nuestra selección",
    logoAssetId: null,
    coverAssetId: null,
    showDescription: true,
    showBusinessPhone: false,
  },
  draftVersion: 1,
  publishedVersion: null,
  canRestore: false,
};
let publishedAppearance = null;
const internalNotes = [];
const savedViews = [];
const writes = [];
const methods = {
  payment: [
    {
      id: "yape",
      code: "YAPE",
      label: "Yape de la tienda",
      instructions: "Verifica el número del negocio",
      enabled: true,
    },
  ],
  shipping: [],
};
const product = {
  id: "product",
  name: "Café de la casa",
  sku: "CAFE-01",
  salePrice: "14.50",
  imageUrl: null,
  storeVisible: false,
  isActive: true,
  category: { id: "category", name: "Bebidas" },
};
const account = {
  id: "account-a",
  status: "ACTIVE",
  createdAt: "2026-11-08T12:00:00Z",
  verifiedAt: "2026-11-08T12:00:00Z",
  customer: {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.test",
    phone: "999111222",
  },
  _count: { orders: 1 },
  orders: [],
};
function makeOrder(id, number, changes = {}) {
  return {
    id,
    number,
    status: "CONFIRMED",
    paymentStatus: "UNDER_REVIEW",
    fulfillment: "UNFULFILLED",
    totalAmount: "25.00",
    createdAt: "2026-11-08T12:00:00Z",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    version: 1,
    saleId: null,
    trackingCode: null,
    refundRequestedAt: null,
    refundReason: null,
    refund: null,
    customer: { name: "Ana Pérez", email: "ana@example.test" },
    allowedActions: ["APPROVE_PAYMENT", "REJECT_PROOF", "EXTEND", "CANCEL"],
    proofs: [{ id: "proof-a", createdAt: "2026-11-08T12:00:00Z" }],
    history: [
      {
        version: 1,
        message: "Pedido recibido",
        createdAt: "2026-11-08T12:00:00Z",
      },
    ],
    snapshot: {
      buyer: { firstName: "Ana", lastName: "Pérez", documentValue: "12345678" },
      payment: {
        id: "manual",
        code: "TRANSFER",
        label: "Transferencia",
        instructions: "Verifica el depósito en la cuenta del negocio",
      },
      shipping: {
        id: "pickup",
        kind: "PICKUP",
        label: "Retiro",
        pickupAddress: "Av. Principal 100",
      },
      address: null,
      lines: [{ name: "Café de la casa", quantity: "1", totalPrice: "25.00" }],
      subtotal: "25.00",
      taxAmount: "0",
      shippingAmount: "0",
      totalAmount: "25.00",
    },
    ...changes,
  };
}
const orders = [
  makeOrder("order-a", "WEB-001"),
  makeOrder("order-b", "WEB-002", {
    fulfillment: "PREPARING",
    paymentStatus: "PENDING",
    allowedActions: ["APPROVE_PAYMENT", "READY", "EXTEND", "CANCEL"],
  }),
];
orders.push(makeOrder("order-review", "WEB-REVIEW"));
const buyerNotices = [];
function notifyBuyer(order, message) {
  buyerNotices.unshift({
    id: `buyer-notice-${buyerNotices.length + 1}`,
    accountId: "buyer-a",
    orderId: order.id,
    version: order.version,
    message,
    createdAt: new Date().toISOString(),
    readAt: null,
    order: { number: order.number },
  });
}
function buyerOrder(order) {
  const { allowedActions, actionAvailability, customer, ...value } = order;
  return value;
}
orders[1].snapshot.payment.code = "CASH_ON_PICKUP";
orders[1].snapshot.payment.label = "Efectivo al retirar";
const deliveryOrder = makeOrder("order-delivery", "WEB-DELIVERY", {
  paymentStatus: "PAID",
  fulfillment: "PREPARING",
  allowedActions: ["SHIP"],
});
deliveryOrder.snapshot.shipping.kind = "DELIVERY";
deliveryOrder.snapshot.shipping.label = "Delivery local";
deliveryOrder.snapshot.address = {
  recipient: "Ana Pérez",
  street: "Av. Principal 200",
  district: "150101",
  phone: "999111222",
};
orders.push(deliveryOrder);
const company = {
  id: "commerce-company",
  name: "Bodega Central",
  slug: "bodega-central",
  timezone: "America/Lima",
  currency: "PEN",
};
const user = () => ({
  id: "commerce-owner",
  email: "owner@example.test",
  fullName: "Dueña de tienda",
  companyId: company.id,
  companyStatus: mode === "MANAGE" ? "ACTIVE" : "SUSPENDED",
  roles,
  planCode: "START",
  subscriptionStatus: "ACTIVE",
  trialEndsAt: null,
});
const capabilities = () =>
  Object.fromEntries(
    [
      "viewDashboard",
      "manageOrders",
      "managePayments",
      "manageCatalog",
      "manageCustomers",
      "manageSettings",
      "managePaymentsConfig",
      "manageShippingConfig",
      "manageRules",
    ].map((key) => [key, mode === "MANAGE"]),
  );
const adminContext = () => ({
  mode,
  experience,
  company: { ...company, status: user().companyStatus },
  store: {
    title: company.name,
    slug: company.slug,
    enabled: true,
    checkoutEnabled: true,
  },
  capabilities: { ...capabilities(), attendExistingOrders: true },
  access: { attendExistingOrders: true },
  generatedAt: new Date().toISOString(),
  extensions: {
    appearance: mode === "MANAGE" && features.appearance,
    notes: mode === "MANAGE" && features.notes,
    savedViews: mode === "MANAGE" && features.savedViews,
  },
});
const dashboard = () => ({
  generatedAt: new Date().toISOString(),
  range: {
    fromKey: "2026-11-02",
    toKey: "2026-11-08",
    timezone: company.timezone,
  },
  metrics: {
    ordersCreated: { value: 42, previous: 20, changePercent: 110 },
    onlineSales: { count: 35, amount: "1250.50" },
    paymentsToReview: { value: 3 },
    preparationPending: { value: 5 },
  },
  deliveriesPending: { total: 4, pickups: 3, shipments: 1 },
  trend: [
    {
      date: "2026-11-08",
      ordersCreated: 42,
      onlineSalesCount: 35,
      onlineSalesAmount: "1250.50",
    },
  ],
  health: { lastOrderAt: new Date().toISOString() },
});

function fixture(resource, params = new URLSearchParams()) {
  if (resource === "/store-admin/experience") return experience;
  if (resource === "/store-admin/features") return features;
  if (
    resource === "/store-admin/appearance" ||
    resource === "/store-admin/appearance/preview"
  )
    return appearance;
  if (resource === "/store-admin/media") return [];
  if (resource.startsWith("/store-admin/internal-notes/"))
    return internalNotes.filter(
      (note) => note.orderId === resource.split("/").at(-1),
    );
  if (resource === "/store-admin/views")
    return savedViews.filter(
      (view) => view.resource === params.get("resource"),
    );
  if (resource === "/auth/me") return user();
  if (resource === "/store-admin/context") return adminContext();
  if (resource === "/store-admin/dashboard") return dashboard();
  if (resource === "/store-admin/products") return [product];
  if (resource === "/store-admin/catalog")
    return {
      data: [product].filter(
        (item) =>
          (!params.get("q") ||
            item.name.toLowerCase().includes(params.get("q").toLowerCase()) ||
            item.sku.toLowerCase().includes(params.get("q").toLowerCase())) &&
          (!params.get("publication") ||
            (params.get("publication") === "published") === item.storeVisible),
      ),
      total: 1,
      page: Number(params.get("page") || 1),
      limit: 24,
      categories: [product.category],
    };
  if (resource === "/store-admin/accounts")
    return { data: [account], total: 1, page: 1, limit: 24 };
  if (resource === "/store-admin/accounts/account-a")
    return {
      ...account,
      orders: [orders.find((order) => order.id === "order-a")],
    };
  if (resource === "/store-admin/settings")
    return {
      slug: company.slug,
      title: company.name,
      enabled: true,
      checkoutEnabled: true,
      registrationEnabled: true,
      taxRate: "0",
      pricesIncludeTax: true,
      reservationMinutes: 30,
    };
  if (resource === "/store-admin/methods") return methods;
  if (resource === "/store-admin/integration") return { configured: false };
  if (resource.startsWith("/store-admin/orders/"))
    return orders.find((order) => order.id === resource.split("/")[3]);
  if (resource === "/store-admin/orders") {
    const filtered = orders.filter((order) => {
      if (
        params.get("q") &&
        !`${order.number} ${order.customer.name}`
          .toLowerCase()
          .includes(params.get("q").toLowerCase())
      )
        return false;
      for (const key of ["status", "paymentStatus", "fulfillment"])
        if (params.get(key) && order[key] !== params.get(key)) return false;
      if (
        params.get("shippingKind") &&
        order.snapshot.shipping.kind !== params.get("shippingKind")
      )
        return false;
      const queue = params.get("queue");
      if (queue === "review")
        return (
          order.paymentStatus === "UNDER_REVIEW" ||
          order.status === "REVIEW_REQUIRED"
        );
      if (queue === "prepare")
        return (
          order.fulfillment === "UNFULFILLED" && order.paymentStatus === "PAID"
        );
      if (queue === "preparing") return order.fulfillment === "PREPARING";
      if (queue === "pickup") return order.fulfillment === "READY_FOR_PICKUP";
      if (queue === "shipping") return order.fulfillment === "SHIPPED";
      return true;
    });
    if (
      ![
        "limit",
        "q",
        "queue",
        "status",
        "paymentStatus",
        "fulfillment",
        "shippingKind",
        "cursor",
      ].some((key) => params.has(key))
    ) {
      const page = Number(params.get("page") || 1);
      return filtered.slice((page - 1) * 30, page * 30);
    }
    const offset = Number((params.get("cursor") ?? "fixture-0").split("-")[1]);
    const limit = Number(params.get("limit") || 30);
    const hasMore = offset + limit < filtered.length;
    return {
      data: filtered.slice(offset, offset + limit),
      totals: { matched: filtered.length },
      pageInfo: {
        hasMore,
        nextCursor: hasMore ? `fixture-${offset + limit}` : null,
      },
      appliedFilters: {},
      asOf: new Date().toISOString(),
    };
  }
  if (resource.startsWith("/store-admin/proofs/"))
    return {
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh9kAAAAASUVORK5CYII=",
    };
  if (resource === "/store-admin/payment-events") return [];
  if (resource === "/notifications/unread-count") return { count: 0 };
  if (resource === "/notifications/preferences")
    return { salesEnabled: true, stockEnabled: true, soundEnabled: false };
  return [];
}

const backend = http.createServer(async (request, response) => {
  const url = new URL(request.url, backendOrigin);
  const resource = url.pathname.replace(/^\/api/, "");
  const buyerAccount =
    /(?:^|;\s*)store_buyer_fixture=(buyer-[ab])(?:;|$)/.exec(
      request.headers.cookie ?? "",
    )?.[1] ?? null;
  response.setHeader("Content-Type", "application/json");
  if (
    resource === "/auth/me" &&
    !request.headers.authorization &&
    !(request.headers.cookie ?? "").includes("access_token=")
  ) {
    response.statusCode = 401;
    return response.end(JSON.stringify({ message: "Sin sesión laboral" }));
  }
  if (
    resource.startsWith("/store/bodega-central/") &&
    request.method === "GET"
  ) {
    const path = resource.slice("/store/bodega-central/".length);
    if (path === "info")
      return response.end(
        JSON.stringify({
          name: company.name,
          currency: "PEN",
          registrationEnabled: true,
          checkoutEnabled: true,
        }),
      );
    if (!buyerAccount) {
      response.statusCode = 401;
      return response.end(JSON.stringify({ message: "Sin sesión comercial" }));
    }
    if (path === "me")
      return response.end(
        JSON.stringify({
          accountId: buyerAccount,
          firstName: buyerAccount === "buyer-a" ? "Ana" : "Bruno",
          lastName: "Cliente",
          email: `${buyerAccount}@example.test`,
          phone: "999111222",
          documentValue: "12345678",
          addresses: [],
        }),
      );
    if (path === "cart")
      return response.end(JSON.stringify({ version: 1, items: [] }));
    if (path === "me/notifications/feed") {
      const data = buyerNotices.filter(
        (notice) => notice.accountId === buyerAccount,
      );
      return response.end(
        JSON.stringify({
          accountId: buyerAccount,
          data: data.slice(0, 50),
          unreadCount: data.filter((notice) => !notice.readAt).length,
        }),
      );
    }
    if (path === "me/notifications")
      return response.end(
        JSON.stringify(
          buyerNotices.filter((notice) => notice.accountId === buyerAccount),
        ),
      );
    if (path === "orders")
      return response.end(
        JSON.stringify(
          buyerAccount === "buyer-a" ? orders.map(buyerOrder) : [],
        ),
      );
    if (path.startsWith("orders/")) {
      const order = orders.find((entry) => entry.id === path.split("/")[1]);
      if (!order || buyerAccount !== "buyer-a") {
        response.statusCode = 404;
        return response.end(
          JSON.stringify({ message: "Pedido no encontrado" }),
        );
      }
      return response.end(JSON.stringify(buyerOrder(order)));
    }
  }
  if (
    resource === "/store-admin/orders" &&
    [...url.searchParams.keys()].some(
      (key) =>
        ![
          "q",
          "status",
          "paymentStatus",
          "fulfillment",
          "queue",
          "shippingKind",
          "cursor",
          "limit",
          "page",
        ].includes(key),
    )
  ) {
    response.statusCode = 400;
    return response.end(
      JSON.stringify({ message: "Filtro administrativo no permitido" }),
    );
  }
  if (resource === "/store-admin/payment-events" && failEvents) {
    response.statusCode = 503;
    return response.end(
      JSON.stringify({ message: "Incidencias temporalmente no disponibles" }),
    );
  }
  if (resource === "/store-admin/dashboard" && failDashboard) {
    response.statusCode = 503;
    return response.end(
      JSON.stringify({ message: "Resumen temporalmente no disponible" }),
    );
  }
  if (["POST", "PATCH"].includes(request.method)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    writes.push({ resource, body });
    if (resource.startsWith("/store/bodega-central/")) {
      if (!buyerAccount) {
        response.statusCode = 401;
        return response.end(
          JSON.stringify({ message: "Sin sesión comercial" }),
        );
      }
      const path = resource.slice("/store/bodega-central/".length);
      if (path === "me/notifications/read") {
        for (const notice of buyerNotices)
          if (notice.accountId === buyerAccount)
            notice.readAt = new Date().toISOString();
        return response.end(JSON.stringify({ read: true }));
      }
      if (path.startsWith("me/notifications/") && path.endsWith("/read")) {
        const notice = buyerNotices.find(
          (entry) =>
            entry.id === path.split("/")[2] && entry.accountId === buyerAccount,
        );
        if (!notice) {
          response.statusCode = 404;
          return response.end(
            JSON.stringify({ message: "Aviso no encontrado" }),
          );
        }
        notice.readAt = new Date().toISOString();
        return response.end(JSON.stringify({ read: true }));
      }
      if (path.endsWith("/payment-proofs")) {
        const order = orders.find((entry) => entry.id === path.split("/")[1]);
        if (!order || buyerAccount !== "buyer-a") {
          response.statusCode = 404;
          return response.end(
            JSON.stringify({ message: "Pedido no encontrado" }),
          );
        }
        assert.ok(body.image.startsWith("data:image/"));
        order.paymentStatus = "UNDER_REVIEW";
        order.version++;
        order.allowedActions = [
          "APPROVE_PAYMENT",
          "REJECT_PROOF",
          "EXTEND",
          "CANCEL",
        ];
        order.proofs.push({
          id: `proof-${order.version}`,
          createdAt: new Date().toISOString(),
        });
        const message = "Comprobante recibido. El negocio revisará el pago.";
        order.history.push({
          version: order.version,
          message,
          createdAt: new Date().toISOString(),
        });
        notifyBuyer(order, message);
        return response.end(JSON.stringify(buyerOrder(order)));
      }
    }
    if (resource === "/store-admin/experience/events")
      return response.end(JSON.stringify({ accepted: true }));
    if (resource === "/store-admin/experience") {
      if (body.expectedVersion !== experience.version) {
        response.statusCode = 409;
        return response.end(
          JSON.stringify({ message: "La experiencia cambió" }),
        );
      }
      experience.enabled = body.enabled;
      experience.version++;
      return response.end(JSON.stringify(experience));
    }
    if (resource === "/store-admin/features") {
      if (body.expectedVersion !== features.version) {
        response.statusCode = 409;
        return response.end(
          JSON.stringify({ message: "La configuración cambió" }),
        );
      }
      Object.assign(features, {
        appearance: body.appearance,
        notes: body.notes,
        savedViews: body.savedViews,
        version: features.version + 1,
      });
      return response.end(JSON.stringify(features));
    }
    if (resource === "/store-admin/appearance") {
      if (body.expectedDraftVersion !== appearance.draftVersion) {
        response.statusCode = 409;
        return response.end(JSON.stringify({ message: "El borrador cambió" }));
      }
      appearance.draft = body.draft;
      appearance.draftVersion++;
      return response.end(JSON.stringify(appearance));
    }
    if (resource === "/store-admin/appearance/publish") {
      if (
        body.expectedDraftVersion !== appearance.draftVersion ||
        body.expectedPublishedVersion !== appearance.publishedVersion
      ) {
        response.statusCode = 409;
        return response.end(
          JSON.stringify({ message: "La publicación cambió" }),
        );
      }
      publishedAppearance = structuredClone(appearance.draft);
      appearance.publishedVersion = (appearance.publishedVersion ?? 0) + 1;
      return response.end(JSON.stringify(appearance));
    }
    if (resource.startsWith("/store-admin/internal-notes/")) {
      internalNotes.unshift({
        id: `note-${internalNotes.length + 1}`,
        orderId: resource.split("/").at(-1),
        body: body.body,
        createdAt: new Date().toISOString(),
        author: { user: { fullName: "Dueña de tienda" } },
      });
      return response.end(JSON.stringify({ id: internalNotes[0].id }));
    }
    if (resource === "/store-admin/views") {
      savedViews.push({
        id: `view-${savedViews.length + 1}`,
        ...body,
        version: 1,
      });
      return response.end(JSON.stringify(savedViews.at(-1)));
    }
    if (resource.startsWith("/store-admin/views/")) {
      const id = resource.split("/")[3];
      const view = savedViews.find((entry) => entry.id === id);
      if (resource.endsWith("/delete"))
        savedViews.splice(savedViews.indexOf(view), 1);
      else {
        if (body.isDefault)
          for (const entry of savedViews) entry.isDefault = false;
        Object.assign(view, body, { version: view.version + 1 });
      }
      return response.end(JSON.stringify({ saved: true }));
    }
    if (resource.startsWith("/store-admin/orders/")) {
      const order = orders.find((entry) => entry.id === resource.split("/")[3]);
      if (
        (conflictOnce &&
          order.id === "order-a" &&
          body.action === "APPROVE_PAYMENT") ||
        order.version !== body.version
      ) {
        conflictOnce = false;
        order.version++;
        response.statusCode = 409;
        return response.end(JSON.stringify({ message: "El pedido cambió" }));
      }
      if (resource.endsWith("/refund")) {
        order.paymentStatus = "REFUNDED";
        order.status = "CANCELLED";
        order.refund = { status: "SUCCEEDED", restockedAt: null };
        order.allowedActions = ["RESTOCK"];
      }
      if (body.action === "APPROVE_PAYMENT") {
        order.paymentStatus = "PAID";
        order.saleId = "sale-a";
        order.allowedActions = ["PREPARE"];
      }
      if (body.action === "REJECT_PROOF") {
        assert.ok(body.reason.length >= 5);
        order.paymentStatus = "REJECTED";
        order.allowedActions = ["APPROVE_PAYMENT", "EXTEND", "CANCEL"];
      }
      if (body.action === "CANCEL") {
        order.status = "CANCELLED";
        order.fulfillment = "CANCELLED";
        order.allowedActions = [];
      }
      if (body.action === "PREPARE") {
        order.fulfillment = "PREPARING";
        order.allowedActions = ["READY"];
      }
      if (body.action === "READY") {
        order.fulfillment = "READY_FOR_PICKUP";
        order.allowedActions = ["DELIVER"];
      }
      if (body.action === "SHIP") {
        order.fulfillment = "SHIPPED";
        order.trackingCode = body.reference;
        order.allowedActions = ["DELIVER"];
      }
      if (body.action === "DELIVER") {
        order.fulfillment = "DELIVERED";
        order.status = "COMPLETED";
        order.allowedActions = [];
      }
      if (body.action === "RESTOCK") {
        order.refund.restockedAt = new Date().toISOString();
        order.allowedActions = [];
      }
      order.version++;
      const noticeMessage =
        body.action === "REJECT_PROOF"
          ? `Comprobante de pago rechazado. Motivo: ${body.reason}. Puedes enviar un nuevo comprobante.`
          : body.action === "APPROVE_PAYMENT"
            ? "Pago aceptado y confirmado. Tu pedido fue confirmado."
            : body.action === "CANCEL"
              ? `El negocio canceló tu pedido. Motivo: ${body.reason}.`
              : body.action === "SHIP"
                ? `Tu pedido fue despachado. Referencia: ${body.reference}.`
                : body.action === "READY"
                  ? "Tu pedido está listo para recoger."
                  : body.action === "DELIVER"
                    ? "Pedido entregado. Gracias por tu compra."
                    : body.action === "PREPARE"
                      ? "Estamos preparando tu pedido."
                      : body.action === "RESTOCK"
                        ? "El negocio registró el retorno físico."
                        : resource.endsWith("/refund")
                          ? "Devolución del pago confirmada."
                          : "El negocio actualizó tu pedido.";
      order.history.push({
        version: order.version,
        message: noticeMessage,
        createdAt: new Date().toISOString(),
      });
      notifyBuyer(order, noticeMessage);
      return response.end(JSON.stringify(order));
    }
    if (resource === "/store-admin/products/product") {
      product.storeVisible = body.visible;
      return response.end(JSON.stringify({ updated: true }));
    }
    if (resource === "/store-admin/customers/account-a") {
      account.status = body.suspended ? "SUSPENDED" : "ACTIVE";
      return response.end(JSON.stringify({ updated: true }));
    }
    if (resource === "/store-admin/payment-methods") {
      if (failSave) {
        failSave = false;
        response.statusCode = 400;
        return response.end(
          JSON.stringify({ message: "No se pudo guardar el método" }),
        );
      }
      const prior = methods.payment.find((item) => item.code === body.code);
      if (prior) Object.assign(prior, body);
      else methods.payment.push({ id: body.code.toLowerCase(), ...body });
      methods.payment.sort((a, b) => a.label.localeCompare(b.label));
      return response.end(JSON.stringify({ saved: true }));
    }
    if (resource.startsWith("/store-admin/shipping-methods")) {
      methods.shipping.push({
        id: "shipping-new",
        pickupAddress: null,
        ...body,
      });
      return response.end(JSON.stringify({ saved: true }));
    }
    return response.end(JSON.stringify({ saved: true }));
  }
  response.end(JSON.stringify(fixture(resource, url.searchParams)));
});

async function main() {
  await new Promise((resolve, reject) => {
    backend.once("error", reject);
    backend.listen(4414, "127.0.0.1", resolve);
  });
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3324",
      "-H",
      "127.0.0.1",
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        BACKEND_URL: backendOrigin,
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let logs = "";
  app.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  app.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  let browser;
  let page;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (app.exitCode !== null) break;
      try {
        if ((await fetch(`${origin}/sign-in`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(ready, logs);
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      window.__commerceStreams = [];
      window.EventSource = class {
        constructor(url) {
          this.url = url;
          this.closed = false;
          window.__commerceStreams.push(this);
          setTimeout(() => this.onopen?.({}), 0);
        }
        close() {
          this.closed = true;
        }
      };
    });
    const cookie = async () =>
      context.addCookies([
        {
          name: "access_token",
          value: `e30.${Buffer.from(JSON.stringify({ ...user(), sub: user().id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`,
          url: origin,
        },
      ]);
    await cookie();
    const routeApi = async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/stream"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: ": heartbeat\n\n",
        });
      const response = await fetch(
        `${backendOrigin}${url.pathname}${url.search}`,
        {
          method: route.request().method(),
          headers: {
            "Content-Type": "application/json",
            Cookie: route.request().headers()["cookie"] ?? "",
            Authorization: route.request().headers()["authorization"] ?? "",
          },
          body: route.request().postData() ?? undefined,
        },
      );
      return route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: await response.text(),
      });
    };
    await context.route("**/api/**", routeApi);
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/store`);
    await page.waitForURL("**/comercio/resumen");
    await page.getByRole("heading", { name: "Resumen de la tienda" }).waitFor();
    await page.getByText("42", { exact: true }).first().waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Desbordamiento a ${width}px`,
      );
    }
    await page.goto(`${origin}/comercio/catalogo`);
    await page
      .getByRole("heading", { name: "Catálogo", exact: true })
      .waitFor();
    await page.getByText("Café de la casa", { exact: true }).waitFor();
    await page.reload();
    await page.getByText("Café de la casa", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Publicar Café de la casa", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ocultar Café de la casa", exact: true })
      .waitFor();
    assert.deepEqual(
      writes.find((entry) => entry.resource === "/store-admin/products/product")
        .body,
      { visible: true },
    );

    await runOrderReviewChecks({
      page,
      browser,
      origin,
      companyId: company.id,
      installApi: (context) => context.route("**/api/**", routeApi),
      writes,
    });
    await page.goto(`${origin}/comercio/pedidos/order-a`);
    await page.getByRole("heading", { name: "WEB-001", exact: true }).waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Detalle desborda a ${width}px`,
      );
    }
    await page
      .getByRole("button", { name: "Ver comprobante 1", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.getByAltText("Comprobante privado del pedido").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    const chooseAction = async (action, reference) => {
      await page.getByLabel("Acción", { exact: true }).selectOption(action);
      if (reference && action === "SHIP")
        await page
          .getByLabel("Referencia de seguimiento", { exact: true })
          .fill(reference);
      else if (reference)
        await page
          .getByLabel("Referencia real de la operación", { exact: true })
          .fill(reference);
      await page
        .getByRole("button", { name: "Confirmar acción", exact: true })
        .click();
    };
    await chooseAction("APPROVE_PAYMENT", "TX-REAL-001");
    await page
      .getByRole("alert")
      .filter({ hasText: "El pedido cambió mientras lo revisabas" })
      .waitFor();
    assert.equal(
      writes.filter((entry) => entry.resource === "/store-admin/orders/order-a")
        .length,
      1,
    );
    assert.equal(
      writes.find((entry) => entry.resource === "/store-admin/orders/order-a")
        .body.version,
      1,
    );
    await chooseAction("APPROVE_PAYMENT", "TX-REAL-001");
    await page
      .getByRole("status")
      .filter({ hasText: "El aviso del pedido está disponible" })
      .waitFor();
    assert.equal(
      writes
        .filter((entry) => entry.resource === "/store-admin/orders/order-a")
        .at(-1).body.version,
      2,
    );
    for (const action of ["PREPARE", "READY", "DELIVER"]) {
      await chooseAction(action);
      await page
        .getByRole("status")
        .filter({ hasText: "El aviso del pedido está disponible" })
        .waitFor();
    }
    await chooseAction("REFUND", "DEV-REAL-001");
    await page
      .getByRole("status")
      .filter({ hasText: "El aviso del pedido está disponible" })
      .waitFor();
    assert.equal(orders[0].refund.restockedAt, null);
    await chooseAction("RESTOCK");
    await page
      .getByRole("status")
      .filter({ hasText: "El aviso del pedido está disponible" })
      .waitFor();
    assert.ok(orders[0].refund.restockedAt);
    await page.goto(`${origin}/comercio/entregas?shippingKind=DELIVERY`);
    await page.getByRole("link").filter({ hasText: "WEB-DELIVERY" }).click();
    await page
      .getByRole("heading", { name: "WEB-DELIVERY", exact: true })
      .waitFor();
    await chooseAction("SHIP", "COURIER-123");
    await page.getByText("Seguimiento: COURIER-123", { exact: true }).waitFor();
    await chooseAction("DELIVER");
    await page
      .getByRole("status")
      .filter({ hasText: "El aviso del pedido está disponible" })
      .waitFor();
    assert.equal(deliveryOrder.fulfillment, "DELIVERED");

    const beforeBoard = writes.length;
    await page.goto(`${origin}/comercio/pedidos?view=board`);
    await page.getByRole("heading", { name: /^En preparación/ }).waitFor();
    await page.getByRole("link").filter({ hasText: "WEB-002" }).waitFor();
    assert.equal(writes.length, beforeBoard);
    await page.goto(`${origin}/comercio/pedidos`);
    await page.getByRole("link").filter({ hasText: "WEB-002" }).waitFor();
    orders.unshift(makeOrder("order-live", "WEB-LIVE"));
    await page.evaluate((companyId) => {
      window.__commerceStreams
        .filter((stream) => !stream.closed)
        .at(-1)
        .onmessage({
          data: JSON.stringify({
            id: "notice-live",
            companyId,
            actionUrl: "/comercio/pedidos/order-live",
            isRead: false,
            title: "Nuevo pedido",
            message: "Pedido recibido",
            type: "SYSTEM",
            createdAt: new Date().toISOString(),
          }),
        });
    }, company.id);
    await page.getByRole("link").filter({ hasText: "WEB-LIVE" }).waitFor();
    assert.equal(
      await page.getByRole("link").filter({ hasText: "WEB-LIVE" }).count(),
      1,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.__commerceStreams.filter((stream) => !stream.closed).length,
      ),
      1,
    );
    orders.unshift(makeOrder("order-reconnect", "WEB-RECONNECT"));
    await page.evaluate(() =>
      window.__commerceStreams
        .filter((stream) => !stream.closed)
        .at(-1)
        .onerror({}),
    );
    await page.getByRole("link").filter({ hasText: "WEB-RECONNECT" }).waitFor();

    for (let index = 1; index <= 35; index++)
      orders.push(makeOrder(`page-${index}`, `PAGE-${index}`));
    await page.goto(`${origin}/comercio/pedidos?q=PAGE-`);
    await page
      .getByRole("link", { name: "Siguiente página", exact: true })
      .click();
    await page.waitForURL("**cursor=fixture-30");
    await page.getByRole("link").filter({ hasText: "PAGE-35" }).waitFor();
    await page
      .getByRole("link", { name: "Primera página", exact: true })
      .click();
    await page
      .getByRole("link")
      .filter({ hasText: "PAGE-1" })
      .first()
      .waitFor();
    failEvents = true;
    await page.goto(`${origin}/comercio/pagos?queue=all&q=WEB-002`);
    await page.getByRole("link").filter({ hasText: "WEB-002" }).waitFor();
    await page
      .getByRole("alert")
      .filter({ hasText: "Incidencias temporalmente" })
      .waitFor();
    failEvents = false;

    await page.goto(`${origin}/comercio/clientes/account-a`);
    await page
      .getByRole("button", { name: "Suspender cuenta comercial", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Reactivar cuenta comercial", exact: true })
      .waitFor();
    assert.equal(account.status, "SUSPENDED");

    await page.goto(`${origin}/comercio/configuracion/pagos`);
    await page
      .getByRole("heading", { name: "Yape de la tienda", exact: true })
      .waitFor();
    const paymentForm = page
      .getByRole("heading", { name: "Agregar método de pago", exact: true })
      .locator("..");
    await paymentForm
      .getByLabel("Tipo de pago", { exact: true })
      .selectOption("TRANSFER");
    await paymentForm
      .getByLabel("Nombre del pago", { exact: true })
      .fill("Transferencia web");
    await paymentForm
      .getByLabel("Instrucciones de pago", { exact: true })
      .fill("Cuenta bancaria 12345");
    failSave = true;
    await paymentForm
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await paymentForm
      .getByRole("alert")
      .filter({ hasText: "No se pudo guardar" })
      .waitFor();
    assert.equal(
      await paymentForm
        .getByLabel("Nombre del pago", { exact: true })
        .inputValue(),
      "Transferencia web",
    );
    await paymentForm
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Transferencia web", exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Dirección de retiro", { exact: true }).count(),
      0,
    );
    await page.goto(`${origin}/comercio/configuracion/entregas`);
    await page.getByLabel("Dirección de retiro", { exact: true }).waitFor();
    await page
      .getByLabel("Tipo de entrega", { exact: true })
      .selectOption("DELIVERY");
    await page
      .getByLabel("Nombre del envío", { exact: true })
      .fill("Delivery web");
    await page.getByLabel("Tarifa de envío", { exact: true }).fill("5.50");
    await page
      .getByLabel("Distritos de cobertura", { exact: false })
      .fill("150101, 150102");
    assert.equal(
      await page.getByLabel("Dirección de retiro", { exact: true }).count(),
      0,
    );
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Delivery web", exact: true })
      .waitFor();
    const shippingWrite = writes.find(
      (entry) => entry.resource === "/store-admin/shipping-methods",
    );
    assert.deepEqual(shippingWrite.body.districts, ["150101", "150102"]);
    assert.equal("pickupAddress" in shippingWrite.body, false);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Formulario desborda a ${width}px`,
      );
    }
    assert.equal(
      await page.getByLabel("Nombre del pago", { exact: true }).count(),
      0,
    );
    await page.goto(`${origin}/comercio/configuracion`);
    await page
      .getByRole("checkbox", { name: "Editor de apariencia", exact: true })
      .check();
    await page
      .getByRole("checkbox", { name: "Notas internas de pedidos", exact: true })
      .check();
    await page
      .getByRole("checkbox", {
        name: "Vistas personales guardadas",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Guardar funciones", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Funciones actualizadas" })
      .waitFor();
    await page.goto(`${origin}/comercio/apariencia`);
    await page
      .getByLabel("Titular", { exact: true })
      .fill("Selección de nuestra tienda");
    await page
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Borrador guardado" })
      .waitFor();
    assert.equal(publishedAppearance, null);
    await page
      .getByRole("button", { name: "Previsualizar borrador", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Selección de nuestra tienda",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Publicar apariencia", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Apariencia publicada" })
      .waitFor();
    assert.equal(publishedAppearance.headline, "Selección de nuestra tienda");
    await page.goto(`${origin}/comercio/pedidos/order-b`);
    await page
      .getByLabel("Nueva nota", { exact: true })
      .fill("Coordinar internamente antes del retiro");
    await page
      .getByRole("button", { name: "Agregar nota interna", exact: true })
      .click();
    await page
      .getByText("Coordinar internamente antes del retiro", { exact: true })
      .waitFor();
    await page.goto(
      `${origin}/comercio/pedidos?q=WEB-002&paymentStatus=PENDING`,
    );
    await page
      .getByLabel("Nombre de la vista", { exact: true })
      .fill("Cobros pendientes");
    await page
      .getByRole("button", { name: "Guardar vista actual", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cobros pendientes", exact: true })
      .waitFor();
    assert.equal("q" in savedViews[0].definition, false);
    await page
      .getByRole("button", { name: "Cobros pendientes", exact: true })
      .click();
    await page.waitForURL(
      (url) =>
        !url.searchParams.has("q") &&
        url.searchParams.get("paymentStatus") === "PENDING",
    );
    await page
      .getByRole("button", {
        name: "Eliminar vista Cobros pendientes",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Cobros pendientes", exact: true })
      .waitFor({ state: "detached" });
    await page.goto(`${origin}/comercio/configuracion`);
    await page
      .getByRole("button", { name: "Volver al panel anterior", exact: true })
      .click();
    await page.waitForURL("**/tienda-administracion");
    await page
      .getByRole("heading", {
        name: "Administración de tienda · Panel anterior",
        exact: true,
      })
      .waitFor();
    await page.goto(`${origin}/comercio/pedidos/order-b`);
    await page.waitForURL("**/tienda-administracion?pedido=order-b");
    await page
      .getByRole("button", { name: "Usar Centro de tienda", exact: true })
      .click();
    await page.waitForURL("**/comercio/resumen");
    assert.equal(features.notes, true);
    assert.ok(
      writes.some(
        (entry) =>
          entry.resource === "/store-admin/experience/events" &&
          entry.body.event === "FORM_SAVED",
      ),
    );
    for (const event of writes.filter(
      (entry) => entry.resource === "/store-admin/experience/events",
    ))
      assert.deepEqual(Object.keys(event.body).sort(), [
        "elapsedMs",
        "event",
        "form",
      ]);
    await page.goto(`${origin}/comercio/apariencia`);
    await page.getByLabel("Titular", { exact: true }).waitFor();
    let previewOpened = false;
    const luminance = (color) =>
      color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    for (const preset of [
      "petroleo-crema",
      "terracota-arena",
      "bosque-marfil",
    ]) {
      await page
        .getByLabel("Tema visual", { exact: true })
        .selectOption(preset);
      await page
        .getByRole("button", { name: "Guardar borrador", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          !document.querySelector('form[data-store-form="APPEARANCE"] fieldset')
            .disabled,
      );
      if (!previewOpened) {
        await page
          .getByRole("button", { name: "Previsualizar borrador", exact: true })
          .click();
        previewOpened = true;
      }
      const colors = await page
        .locator(".store-appearance-banner")
        .evaluate((element) => ({
          text: getComputedStyle(element.querySelector("h2")).color,
          background: getComputedStyle(element).backgroundColor,
        }));
      const values = [
        luminance(colors.text),
        luminance(colors.background),
      ].sort((a, b) => b - a);
      assert.ok(
        (values[0] + 0.05) / (values[1] + 0.05) >= 4.5,
        `Contraste del titular en ${preset}`,
      );
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Desbordamiento con texto al 200%",
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await page.goto(`${origin}/comercio/catalogo`);
    await page.goto(`${origin}/comercio/clientes`);
    await page.goBack();
    await page
      .getByRole("heading", { name: "Catálogo", exact: true })
      .waitFor();
    await page.goForward();
    await page
      .getByRole("heading", { name: "Clientes de la tienda", exact: true })
      .waitFor();
    mode = "CLOSEOUT";
    await cookie();
    await page.goto(`${origin}/store`);
    await page.waitForURL("**/comercio/atencion/pedidos");
    await page
      .getByRole("heading", { name: "Atención de pedidos existentes" })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Catálogo", exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "Access token del comercio" })
        .count(),
      0,
    );
    await page.goto(`${origin}/comercio/configuracion`);
    await page.waitForURL("**/comercio/atencion/pedidos");
    await page.goto(`${origin}/atencion-tienda`);
    await page.waitForURL("**/comercio/atencion/pedidos");
    await page.goto(`${origin}/comercio/pedidos/order-b`);
    await page.waitForURL("**/comercio/atencion/pedidos/order-b");
    await page.getByRole("heading", { name: "WEB-002", exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("option", { name: "Confirmar entrega", exact: true })
        .evaluate((option) => option.disabled),
      true,
    );

    mode = "MANAGE";
    roles = ["CASHIER"];
    await cookie();
    await page.goto(`${origin}/comercio/catalogo`);
    await page.waitForURL("**/forbidden");
    roles = ["COMPANY_ADMIN"];
    await cookie();
    failDashboard = true;
    await page.goto(`${origin}/comercio/resumen`);
    await page
      .getByRole("alert")
      .filter({ hasText: "No se pudo cargar el resumen" })
      .waitFor({ timeout: 30_000 });
    failDashboard = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByText("42", { exact: true }).first().waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: fases 1–6: operación, gestión, apariencia y colaboración; SSE, reversión y restauración del panel; telemetría sin campos personales; teclado, texto al 200% y responsive.",
    );
    await context.close();
  } catch (error) {
    console.error(logs);
    if (page && !page.isClosed())
      console.error(
        await page.locator("select").evaluateAll((selects) =>
          selects.map((select) => ({
            html: select.outerHTML,
            labels: [...select.labels].map((label) => label.textContent),
          })),
        ),
      );
    throw error;
  } finally {
    await browser?.close();
    app.kill();
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
