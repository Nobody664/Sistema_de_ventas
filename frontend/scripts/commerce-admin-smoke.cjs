const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const origin = "http://127.0.0.1:3324";
const backendOrigin = "http://127.0.0.1:4414";
let mode = "MANAGE";
let roles = ["COMPANY_ADMIN"];
let failDashboard = false;
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

function fixture(resource) {
  if (resource === "/auth/me") return user();
  if (resource === "/store-admin/context") return adminContext();
  if (resource === "/store-admin/dashboard") return dashboard();
  if (resource === "/store-admin/products")
    return [{ id: "product", name: "Café de la casa", storeVisible: true }];
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
  if (resource === "/store-admin/methods") return { payment: [], shipping: [] };
  if (resource === "/store-admin/integration") return { configured: false };
  if (
    resource === "/store-admin/orders" ||
    resource === "/store-admin/payment-events"
  )
    return [];
  if (resource === "/notifications/unread-count") return { count: 0 };
  if (resource === "/notifications/preferences")
    return { salesEnabled: true, stockEnabled: true, soundEnabled: false };
  return [];
}

const backend = http.createServer((request, response) => {
  const resource = new URL(request.url, backendOrigin).pathname.replace(
    /^\/api/,
    "",
  );
  response.setHeader("Content-Type", "application/json");
  if (resource === "/store-admin/dashboard" && failDashboard) {
    response.statusCode = 503;
    return response.end(
      JSON.stringify({ message: "Resumen temporalmente no disponible" }),
    );
  }
  response.end(JSON.stringify(fixture(resource)));
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
    await context.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/stream"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: ": heartbeat\n\n",
        });
      const response = await fetch(
        `${backendOrigin}${url.pathname}${url.search}`,
      );
      return route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: await response.text(),
      });
    });
    const page = await context.newPage();
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

    await page.goto(`${origin}/comercio/configuracion/pagos`);
    await page.getByLabel("Nombre del pago", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Dirección de retiro", { exact: true }).count(),
      0,
    );
    await page.goto(`${origin}/comercio/configuracion/entregas`);
    await page.getByLabel("Dirección de retiro", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Nombre del pago", { exact: true }).count(),
      0,
    );
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
      "PASS: /store y /atencion-tienda, contexto MANAGE/CLOSEOUT, recarga profunda, autorización, errores recuperables y anchos 320/390/768/1440.",
    );
    await context.close();
  } catch (error) {
    console.error(logs);
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
