const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const origin = "http://127.0.0.1:3317";
const user = {
  id: "test-user",
  email: "smoke@example.test",
  fullName: "Usuario de prueba",
  roles: ["COMPANY_ADMIN"],
  companyId: "test-company",
  companyStatus: "ACTIVE",
  planCode: "PRO",
  subscriptionStatus: "ACTIVE",
  trialEndsAt: null,
};
let activeUser = user;
let pendingUpgrade = null;
const tenantRequests = [];
const requestedResources = [];
const deleteRequests = [];
let categoryDeleted = false;
let billingAvailable = true;
let pendingPayment = null;
const currentPlan = {
  id: "plan-start",
  code: "START",
  name: "Plan Negocio",
  isActive: true,
  priceMonthly: "39.00",
  priceYearly: "390.00",
  features: [],
};
const metrics = {
  company: { name: "Negocio de prueba", currency: "PEN" },
  salesScope: "COMPANY",
  salesToday: 32,
  revenueToday: 500,
  inventoryMetrics: { lowStockCount: 7, outOfStockCount: 2 },
  dataCoverage: { inventory: { returned: 25, total: 25, truncated: false } },
  salesAnalytics: {
    totalSales: 1200,
    totalRevenue: 19000,
    averageTicket: 15.83,
  },
};
const account = {
  id: "a1",
  name: "Cuenta de prueba",
  type: "BANK",
  currency: "PEN",
  initialBalance: 0,
  isActive: true,
  notes: null,
  income: 0,
  expense: 0,
  balance: 0,
};

function data(resource) {
  if (resource === "/notifications/preferences")
    return { salesEnabled: true, stockEnabled: true, soundEnabled: false };
  if (resource === "/companies/current")
    return {
      id: activeUser.companyId,
      name: "Negocio de prueba",
      legalName: null,
      taxId: null,
      address: null,
      email: null,
      phone: null,
      timezone: "America/Lima",
      currency: "PEN",
    };
  if (resource === "/auth/me") return activeUser;
  if (resource === "/auth/login") return { user: activeUser };
  if (resource === "/subscriptions/current")
    return {
      id: "subscription-1",
      companyId: activeUser.companyId,
      status: "ACTIVE",
      plan: currentPlan,
      billingCycle: "MONTHLY",
      startDate: "2026-10-01T05:00:00Z",
      endDate: "2026-11-01T05:00:00Z",
    };
  if (resource === "/subscriptions/upgrade-requests/my/pending")
    return pendingUpgrade;
  if (resource === "/company-profile/completeness")
    return { complete: true, missingFields: [] };
  if (resource === "/plans") return [currentPlan];
  if (resource === "/billing/status")
    return billingAvailable
      ? {
          subscription: { ...data("/subscriptions/current"), autoRenew: true },
          currentPending: pendingPayment,
          lastPayment: null,
          recentPayments: pendingPayment
            ? [
                {
                  ...pendingPayment,
                  paidAt: null,
                  createdAt: "2026-10-01T05:00:00Z",
                },
              ]
            : [],
        }
      : null;
  if (resource === "/payments/current-pending") return null;
  if (resource === "/products/categories")
    return categoryDeleted
      ? []
      : [
          {
            id: "category-1",
            name: "Galletas",
            slug: "galletas",
            _count: { products: 0 },
          },
        ];
  if (resource === "/dashboard/global")
    return {
      totalCompanies: 2,
      activeCompanies: 2,
      totalUsers: 3,
      totalSubscriptions: 2,
    };
  if (resource === "/companies") return { data: [], total: 0 };
  if (resource === "/plan-capabilities/me")
    return {
      planId: "plan",
      planCode: "PRO",
      planName: "Pro",
      modules: [
        "sales",
        "inventory",
        "support",
        "dashboard",
        "notifications",
        "products",
        "categories",
        "customers",
        "distributors",
        "reports",
      ],
      features: [],
      apiEnabled: true,
      maxUsers: 10,
      maxProducts: 100,
    };
  if (resource === "/dashboard/tenant")
    return {
      ...metrics,
      salesScope: activeUser.roles.includes("CASHIER") ? "SELLER" : "COMPANY",
    };
  if (resource === "/customers")
    return [
      {
        id: "customer-1",
        firstName: "Cliente",
        lastName: "Prueba",
        email: null,
        phone: null,
        createdAt: new Date().toISOString(),
      },
    ];
  if (resource === "/notifications/unread-count") return { count: 0 };
  if (resource === "/support/chat/conversations/chat-1")
    return { id: "chat-1", subject: "Prueba de borrador", status: "OPEN" };
  if (resource === "/platform/finance/summary")
    return {
      currency: "PEN",
      accounts: [account],
      totals: {
        subscriptionRevenue: 0,
        manualIncome: 0,
        totalIncome: 0,
        totalExpense: 0,
        net: 0,
        payments: 0,
        transactions: 0,
      },
      monthly: [],
      expensesByCategory: [],
    };
  if (resource === "/platform/finance/transactions")
    return { items: [], totalPages: 1, total: 0 };
  return [];
}

const backend = http.createServer((request, response) => {
  const resource = new URL(request.url, "http://localhost").pathname.replace(
    /^\/api/,
    "",
  );
  response.setHeader("Content-Type", "application/json");
  requestedResources.push(resource);
  if (resource === "/dashboard/tenant") {
    tenantRequests.push(resource);
    if (!activeUser.companyId) {
      response.statusCode = 403;
      return response.end(
        JSON.stringify({
          message: "Tenant context is required for this resource.",
        }),
      );
    }
  }
  const body = data(resource);
  response.end(body === null ? undefined : JSON.stringify(body));
});

async function main() {
  await new Promise((resolve, reject) => {
    backend.once("error", reject);
    backend.listen(4407, "127.0.0.1", resolve);
  });
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3317",
      "-H",
      "127.0.0.1",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        BACKEND_URL: "http://127.0.0.1:4407",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverLog = "";
  app.stdout.on("data", (chunk) => {
    serverLog += chunk;
  });
  app.stderr.on("data", (chunk) => {
    serverLog += chunk;
  });
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (app.exitCode !== null) break;
      try {
        if ((await fetch(`${origin}/sign-in`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(ready, serverLog);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      timezoneId: "America/Lima",
    });
    let pendingPost;
    let postSeen = false;
    await context.route("**/api/**", async (route) => {
      const resource = new URL(route.request().url()).pathname.replace(
        /^\/api/,
        "",
      );
      if (
        resource.endsWith("/messages") &&
        route.request().method() === "POST"
      ) {
        postSeen = true;
        await new Promise((resolve) => {
          pendingPost = resolve;
        });
      }
      if (resource.endsWith("/stream"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: ": heartbeat\n\n",
        });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data(resource)),
      });
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) =>
        window.cspViolations.push({
          directive: event.effectiveDirective,
          uri: event.blockedURI,
        }),
      );
    });
    const response = await page.goto(`${origin}/sign-in`);
    const policy = response.headers()["content-security-policy"];
    assert.match(policy, /script-src[^;]*'nonce-/);
    assert.ok(
      !policy
        .split(";")
        .find((entry) => entry.includes("script-src"))
        .includes("unsafe-inline"),
    );
    await page.getByRole("button", { name: "Mostrar contraseña" }).click();
    assert.equal(await page.locator("#password").getAttribute("type"), "text");
    assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
    console.log("PASS: CSP con nonce y controles hidratados en producción");

    const source = readFileSync(path.join(root, "lib/print-html.ts"), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    await page.evaluate((code) => {
      const module = { exports: {} };
      new Function("exports", code)(module.exports);
      window.printHtmlForSmoke = module.exports.printHtml;
    }, compiled);
    const printResult = await page.evaluate(async () => {
      let calls = 0;
      const append = document.body.appendChild.bind(document.body);
      document.body.appendChild = function (node) {
        if (node.tagName === "IFRAME")
          node.addEventListener(
            "load",
            () => {
              node.contentWindow.print = () => {
                calls++;
              };
            },
            true,
          );
        return append(node);
      };
      await window.printHtmlForSmoke(
        "<!doctype html><html><head><style>h1{color:rgb(10,20,30)}</style></head><body><h1>Boleta funcional</h1><script>parent.printCompromised=true</script></body></html>",
      );
      const frame = document.querySelector("iframe");
      const result = {
        calls,
        compromised: !!window.printCompromised,
        sandbox: frame.getAttribute("sandbox"),
        text: frame.contentDocument.body.textContent,
        color: frame.contentWindow.getComputedStyle(
          frame.contentDocument.querySelector("h1"),
        ).color,
      };
      document.body.appendChild = append;
      return result;
    });
    assert.equal(printResult.calls, 1);
    assert.equal(printResult.compromised, false);
    assert.equal(printResult.sandbox, "allow-same-origin allow-modals");
    assert.match(printResult.text, /Boleta funcional/);
    assert.equal(printResult.color, "rgb(10, 20, 30)");
    await page.waitForTimeout(1200);
    assert.equal(await page.locator("iframe").count(), 0);
    console.log(
      "PASS: impresión invocada, contenido/CSS conservados, scripts bloqueados y frame eliminado",
    );

    const payload = Buffer.from(
      JSON.stringify({
        ...user,
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    await context.addCookies([
      { name: "access_token", value: `e30.${payload}.test`, url: origin },
    ]);
    await page.goto(`${origin}/sales`);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator("html.dark").waitFor();
    await page.getByRole("button", { name: "Exportar", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "CSV", exact: true }).waitFor();
    await page.getByRole("menuitem", { name: "CSV", exact: true }).focus();
    assert.notEqual(
      await page
        .getByRole("menu")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(255, 255, 255)",
    );
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(
      () => document.activeElement?.textContent === "Excel",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Excel",
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("menu").count(), 0);
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Exportar",
    );
    console.log("PASS: menú con Enter, flechas, Escape y restauración de foco");
    await page.emulateMedia({ colorScheme: "light" });
    await page.locator("html:not(.dark)").waitFor();
    await page
      .getByRole("link", { name: /Nueva venta/ })
      .first()
      .click();
    await page.waitForURL("**/sales/new");
    assert.deepEqual(await page.evaluate(() => window.cspViolations), []);

    await page.goto(`${origin}/customers`);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.ok(
      (await page.getByRole("dialog").getAttribute("class")).includes(
        "sm:max-w-[425px]",
      ),
    );
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((element) => parseFloat(getComputedStyle(element).width)),
      425,
    );
    await page.keyboard.press("Escape");
    console.log(
      "PASS: diálogo respeta la clase del llamador y cierra con Escape",
    );

    await page.goto(`${origin}/support/chat/chat-1`);
    await page
      .getByRole("textbox", { name: "Mensaje de soporte" })
      .fill("Primer mensaje");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    for (let attempt = 0; attempt < 100 && !postSeen; attempt++)
      await page.waitForTimeout(20);
    assert.ok(postSeen);
    await page
      .getByRole("textbox", { name: "Mensaje de soporte" })
      .fill("Nuevo borrador");
    pendingPost();
    await page.waitForTimeout(500);
    assert.equal(
      await page
        .getByRole("textbox", { name: "Mensaje de soporte" })
        .inputValue(),
      "Nuevo borrador",
    );
    assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
    assert.deepEqual(pageErrors, []);
    console.log(
      "PASS: respuesta tardía conserva el borrador; sin errores de página ni violaciones CSP",
    );
    await context.close();

    const accessFailures = [];
    const cases = [
      {
        name: "dashboard operativo sin informes duplicados, adaptable y compatible con ambos temas",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          await rolePage.setViewportSize({ width: 1440, height: 1050 });
          const start = requestedResources.length;
          await rolePage.goto(`${origin}/dashboard`);
          await rolePage
            .getByRole("heading", { name: "Lo importante, hoy.", exact: true })
            .waitFor();
          assert.equal(
            await rolePage
              .getByText("Importe vendido hoy", { exact: true })
              .count(),
            1,
          );
          assert.equal(
            await rolePage.getByText("Ventas de hoy", { exact: true }).count(),
            1,
          );
          assert.equal(
            await rolePage
              .getByText("Ticket promedio", { exact: true })
              .count(),
            1,
          );
          await rolePage
            .getByRole("heading", {
              name: "Atención al inventario",
              exact: true,
            })
            .waitFor();
          assert.equal(
            await rolePage
              .getByText("Rendimiento de Ventas", { exact: true })
              .count(),
            0,
          );
          assert.equal(
            await rolePage
              .getByRole("button", { name: "30 días", exact: true })
              .count(),
            0,
          );
          assert.equal(
            requestedResources
              .slice(start)
              .some((resource) => resource.startsWith("/dashboard/metrics")),
            false,
          );
          await rolePage.evaluate(() => document.fonts.ready);
          if (process.env.REFIX_SCREENSHOT_DIR)
            await rolePage.screenshot({
              path: path.join(
                process.env.REFIX_SCREENSHOT_DIR,
                "dashboard-desktop-light.png",
              ),
              fullPage: true,
            });
          await rolePage.emulateMedia({ colorScheme: "dark" });
          await rolePage.locator("html.dark").waitFor();
          if (process.env.REFIX_SCREENSHOT_DIR)
            await rolePage.screenshot({
              path: path.join(
                process.env.REFIX_SCREENSHOT_DIR,
                "dashboard-desktop-dark.png",
              ),
              fullPage: true,
            });
          await rolePage.emulateMedia({ colorScheme: "light" });
          await rolePage.locator("html:not(.dark)").waitFor();
          await rolePage.setViewportSize({ width: 390, height: 844 });
          assert.equal(
            await rolePage.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
            true,
          );
          if (process.env.REFIX_SCREENSHOT_DIR)
            await rolePage.screenshot({
              path: path.join(
                process.env.REFIX_SCREENSHOT_DIR,
                "dashboard-mobile.png",
              ),
              fullPage: true,
            });
        },
      },
      {
        name: "Operaciones abre a la derecha con cinco rutas y funciona dentro del menú móvil",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          await rolePage.setViewportSize({ width: 1440, height: 1000 });
          await rolePage.goto(`${origin}/dashboard`);
          const sidebar = rolePage.getByRole("complementary", {
            name: "Menú de control",
          });
          assert.equal(
            await sidebar
              .getByRole("link", { name: "Notificaciones", exact: true })
              .count(),
            0,
          );
          await rolePage
            .getByRole("button", { name: /^Notificaciones:/ })
            .waitFor();
          assert.equal(
            await sidebar
              .getByRole("link", { name: "Proveedores", exact: true })
              .count(),
            0,
          );
          const trigger = sidebar.getByRole("button", {
            name: "Operaciones",
            exact: true,
          });
          await trigger.click();
          const menu = rolePage.getByRole("menu");
          await menu.waitFor();
          assert.equal(await menu.getAttribute("data-side"), "right");
          const labels = [
            "Cupones",
            "Distribuidores",
            "Proveedores",
            "Órdenes de compra",
            "Notas de crédito",
          ];
          assert.deepEqual(
            (await menu.getByRole("menuitem").allTextContents()).map((label) =>
              label.trim(),
            ),
            labels,
          );
          await menu
            .getByRole("menuitem", { name: "Cupones", exact: true })
            .focus();
          await rolePage.keyboard.press("ArrowDown");
          await rolePage.waitForFunction(
            () => document.activeElement?.textContent === "Distribuidores",
          );
          await rolePage.keyboard.press("Escape");
          await menu.waitFor({ state: "hidden" });
          assert.equal(
            await trigger.evaluate(
              (element) => element === document.activeElement,
            ),
            true,
          );
          await rolePage.setViewportSize({ width: 390, height: 844 });
          await rolePage
            .getByRole("button", { name: "Abrir menú de navegación" })
            .click();
          const drawer = rolePage.getByRole("dialog", {
            name: "Menú de navegación",
          });
          const mobileTrigger = drawer.getByRole("button", {
            name: "Operaciones",
            exact: true,
          });
          await mobileTrigger.click();
          assert.equal(
            await mobileTrigger.getAttribute("aria-expanded"),
            "true",
          );
          for (const label of labels)
            await drawer
              .getByRole("link", { name: label, exact: true })
              .waitFor();
          await drawer
            .getByRole("link", { name: "Proveedores", exact: true })
            .click();
          await rolePage.waitForURL("**/suppliers");
          await drawer.waitFor({ state: "hidden" });
        },
      },
      {
        name: "el cajero ve sus ventas sin inventario ni operaciones administrativas",
        roles: ["CASHIER"],
        companyId: "test-company",
        run: async (rolePage) => {
          await rolePage.goto(`${origin}/dashboard`);
          await rolePage.getByText(/Solo tus ventas/).waitFor();
          await rolePage
            .getByText("Tu importe vendido hoy", { exact: true })
            .waitFor();
          assert.equal(
            await rolePage
              .getByRole("heading", {
                name: "Atención al inventario",
                exact: true,
              })
              .count(),
            0,
          );
          assert.equal(
            await rolePage
              .getByRole("button", { name: "Operaciones", exact: true })
              .count(),
            0,
          );
        },
      },
      {
        name: "SUPER_ADMIN sin empresa entra a plataforma y no consulta dashboard tenant",
        roles: ["SUPER_ADMIN"],
        companyId: null,
        run: async (rolePage) => {
          const previousRequests = tenantRequests.length;
          const requestStart = requestedResources.length;
          await rolePage.goto(`${origin}/sign-in?redirect=/dashboard`);
          await rolePage
            .getByLabel("Correo electrónico")
            .fill("smoke@example.test");
          await rolePage
            .getByLabel("Contraseña", { exact: true })
            .fill("fixture-password");
          await rolePage
            .getByRole("button", { name: "Iniciar sesión", exact: true })
            .click();
          await rolePage.waitForURL("**/platform");
          await rolePage
            .getByRole("heading", { name: "Panel de la Plataforma" })
            .waitFor();
          await rolePage.goto(`${origin}/dashboard`);
          await rolePage.waitForURL("**/platform");
          await rolePage.goto(`${origin}/subscription`);
          await rolePage.waitForURL("**/platform/plans");
          await rolePage.goto(`${origin}/checkout?plan=START`);
          await rolePage.waitForURL("**/platform/plans");
          await rolePage.goto(`${origin}/payments`);
          await rolePage.waitForURL("**/platform/finanzas");
          await rolePage.goto(`${origin}/settings`);
          await rolePage
            .getByRole("heading", { name: "Configuración", exact: true })
            .waitFor();
          assert.equal(
            await rolePage
              .getByRole("heading", { name: "Empresa", exact: true })
              .count(),
            0,
          );
          await rolePage.goto(`${origin}/profile`);
          await rolePage
            .getByRole("link", { name: "Plataforma", exact: true })
            .first()
            .waitFor();
          assert.equal(tenantRequests.length, previousRequests);
          const forbiddenOwnResources = [
            "/dashboard/tenant",
            "/plan-capabilities/me",
            "/company-profile/completeness",
            "/subscriptions/current",
            "/billing/status",
            "/companies/current",
          ];
          assert.deepEqual(
            requestedResources
              .slice(requestStart)
              .filter((resource) => forbiddenOwnResources.includes(resource)),
            [],
          );
        },
      },
      {
        name: "COMPANY_ADMIN consulta su plan sin solicitud pendiente (HTTP 200 vacío)",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          await rolePage.goto(`${origin}/subscription`);
          await rolePage
            .getByRole("heading", { name: "Mi Plan", exact: true })
            .waitFor();
          await rolePage
            .getByRole("heading", { name: "Plan Negocio", exact: true })
            .waitFor();
          assert.ok(!rolePage.url().includes("forbidden"));
        },
      },
      {
        name: "COMPANY_ADMIN ve el plan y el destino real de una solicitud pendiente",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          pendingUpgrade = {
            id: "upgrade-1",
            status: "PENDING",
            plan: { code: "SCALE", name: "Plan Scale" },
          };
          await rolePage.goto(`${origin}/subscription`);
          await rolePage
            .getByRole("heading", { name: "Cambio de Plan en Proceso" })
            .waitFor();
          await rolePage.getByText("Plan Scale", { exact: true }).waitFor();
        },
      },
      {
        name: "COMPANY_ADMIN consulta pagos pendientes sin consultas auxiliares de estado vacío",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          pendingPayment = {
            id: "payment-1",
            amount: "39.00",
            status: "PENDING",
            dueDate: "2026-11-01T05:00:00Z",
            hasProof: false,
            proofStatus: null,
          };
          const start = requestedResources.length;
          await rolePage.goto(`${origin}/payments`);
          await rolePage
            .getByRole("heading", { name: "Mis Pagos", exact: true })
            .waitFor();
          await rolePage
            .getByRole("heading", { name: "Pago Pendiente", exact: true })
            .waitFor();
          await rolePage
            .getByRole("button", { name: "Subir comprobante de pago" })
            .waitFor();
          assert.equal(
            requestedResources
              .slice(start)
              .includes("/payments/current-pending"),
            false,
          );
          assert.equal(
            requestedResources.slice(start).includes("/payments/history"),
            false,
          );
        },
      },
      {
        name: "COMPANY_ADMIN ve sus pagos aunque no tenga pagos pendientes",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          await rolePage.goto(`${origin}/payments`);
          await rolePage
            .getByRole("heading", { name: "Mis Pagos", exact: true })
            .waitFor();
          await rolePage
            .getByText("No hay pagos registrados aún", { exact: true })
            .waitFor();
        },
      },
      {
        name: "la ausencia de suscripción en pagos es un estado vacío legítimo",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          billingAvailable = false;
          await rolePage.goto(`${origin}/payments`);
          await rolePage
            .getByRole("heading", {
              name: "Sin suscripción activa",
              exact: true,
            })
            .waitFor();
        },
      },
      {
        name: "el comprobante pendiente de revisión no se vuelve a solicitar",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          pendingPayment = {
            id: "payment-1",
            amount: "39.00",
            status: "PENDING",
            dueDate: "2026-11-01T05:00:00Z",
            hasProof: true,
            proofStatus: "PENDING",
          };
          await rolePage.goto(`${origin}/payments`);
          await rolePage
            .getByRole("heading", {
              name: "Comprobante en revisión",
              exact: true,
            })
            .waitFor();
          assert.equal(
            await rolePage
              .getByRole("button", { name: "Subir comprobante de pago" })
              .count(),
            0,
          );
        },
      },
      {
        name: "COMPANY_ADMIN elimina una categoría con JSON y CSRF activo",
        roles: ["COMPANY_ADMIN"],
        companyId: "test-company",
        run: async (rolePage) => {
          const start = deleteRequests.length;
          await rolePage.goto(`${origin}/categories`);
          await rolePage
            .getByRole("heading", { name: "Galletas", exact: true })
            .waitFor();
          await rolePage
            .getByRole("button", { name: "Eliminar", exact: true })
            .click();
          await rolePage
            .getByRole("dialog")
            .getByRole("button", { name: "Eliminar", exact: true })
            .click();
          await rolePage.getByRole("dialog").waitFor({ state: "hidden" });
          await rolePage
            .getByRole("heading", { name: "Galletas", exact: true })
            .waitFor({ state: "hidden" });
          assert.equal(deleteRequests.length, start + 1);
          assert.match(deleteRequests[start], /^application\/json/);
        },
      },
    ];
    for (const scenario of cases) {
      activeUser = {
        ...user,
        roles: scenario.roles,
        companyId: scenario.companyId,
        companyStatus: scenario.companyId ? "ACTIVE" : null,
        planCode: scenario.companyId ? "START" : null,
        subscriptionStatus: scenario.companyId ? "ACTIVE" : null,
      };
      pendingUpgrade = null;
      pendingPayment = null;
      billingAvailable = true;
      categoryDeleted = false;
      const roleContext = await browser.newContext();
      const rolePayload = Buffer.from(
        JSON.stringify({
          ...activeUser,
          sub: activeUser.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
      await roleContext.addCookies([
        { name: "access_token", value: `e30.${rolePayload}.test`, url: origin },
      ]);
      await roleContext.route("**/api/**", (route) => {
        const resource = new URL(route.request().url()).pathname.replace(
          /^\/api/,
          "",
        );
        requestedResources.push(resource);
        if (
          resource === "/products/categories/category-1" &&
          route.request().method() === "DELETE"
        ) {
          const contentType = route.request().headers()["content-type"] ?? "";
          deleteRequests.push(contentType);
          if (!contentType.startsWith("application/json"))
            return route.fulfill({
              status: 403,
              contentType: "application/json",
              body: JSON.stringify({
                message: "Operación rechazada (protección CSRF)",
              }),
            });
          categoryDeleted = true;
          return route.fulfill({ status: 204 });
        }
        if (resource.endsWith("/stream"))
          return route.fulfill({
            contentType: "text/event-stream",
            body: ": heartbeat\n\n",
          });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(data(resource)),
        });
      });
      const rolePage = await roleContext.newPage();
      rolePage.setDefaultTimeout(10_000);
      const errors = [];
      rolePage.on("pageerror", (error) => errors.push(error.message));
      try {
        await scenario.run(rolePage);
        assert.deepEqual(errors, []);
        console.log(`PASS: ${scenario.name}`);
      } catch (error) {
        accessFailures.push(`${scenario.name}: ${error.message}`);
        console.error(`FAIL: ${scenario.name}: ${rolePage.url()}`);
      } finally {
        await roleContext.close();
      }
    }
    assert.deepEqual(accessFailures, []);
  } finally {
    if (browser) await browser.close();
    app.kill();
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
