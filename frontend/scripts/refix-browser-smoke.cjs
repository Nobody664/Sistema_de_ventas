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
  roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
  companyId: "test-company",
  companyStatus: "ACTIVE",
  planCode: "PRO",
  subscriptionStatus: "ACTIVE",
  trialEndsAt: null,
};
let activeUser = user;
let pendingUpgrade = null;
const tenantRequests = [];
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
  salesScope: "COMPANY",
  salesToday: 32,
  revenueToday: 500,
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
  if (resource === "/plan-capabilities/me")
    return {
      planId: "plan",
      planCode: "PRO",
      planName: "Pro",
      modules: ["sales", "inventory", "support", "dashboard", "notifications"],
      features: [],
      apiEnabled: true,
      maxUsers: 10,
      maxProducts: 100,
    };
  if (resource === "/dashboard/tenant") return metrics;
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
    assert.notEqual(
      await page
        .getByRole("menu")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(255, 255, 255)",
    );
    await page.keyboard.press("ArrowDown");
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

    await page.goto(`${origin}/platform/finanzas`);
    await page.getByRole("button", { name: "Movimiento", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.ok((await dialog.getAttribute("class")).includes("max-w-lg"));
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
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
        name: "SUPER_ADMIN sin empresa entra a plataforma y no consulta dashboard tenant",
        roles: ["SUPER_ADMIN"],
        companyId: null,
        run: async (rolePage) => {
          const previousRequests = tenantRequests.length;
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
          await rolePage.waitForURL("**/platform");
          assert.equal(tenantRequests.length, previousRequests);
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
    ];
    for (const scenario of cases) {
      activeUser = {
        ...user,
        roles: scenario.roles,
        companyId: scenario.companyId,
      };
      pendingUpgrade = null;
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
