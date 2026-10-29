const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const origin = "http://127.0.0.1:3320";
const backendOrigin = "http://127.0.0.1:4410";
let roles = ["COMPANY_ADMIN"];
const company = {
  id: "company-a",
  name: "Negocio de pruebas",
  legalName: null,
  taxId: null,
  address: null,
  email: null,
  phone: null,
  timezone: "America/Lima",
  currency: "PEN",
};
let failSave = false;
let failClientAuth = false;
let completenessReads = 0;
const requests = [];
const writes = [];
const preferences = {
  salesEnabled: true,
  stockEnabled: true,
  soundEnabled: true,
};
const platform = () => roles.includes("SUPER_ADMIN");
const user = () => ({
  id: "user-a",
  email: "owner@example.test",
  fullName: "Owner",
  roles,
  companyId: platform() ? null : company.id,
  companyStatus: platform() ? null : "ACTIVE",
  planCode: platform() ? null : "START",
  subscriptionStatus: platform() ? null : "ACTIVE",
  trialEndsAt: null,
});
const complete = () =>
  [
    company.legalName,
    company.taxId,
    company.address,
    company.email,
    company.phone,
  ].every(Boolean);

function data(resource) {
  if (resource === "/auth/me") return user();
  if (resource === "/companies/current") return company;
  if (resource === "/notifications/preferences") return preferences;
  if (resource === "/plan-capabilities/me")
    return {
      planId: "plan-a",
      planCode: "START",
      planName: "Start",
      modules: [
        "sales",
        "products",
        "categories",
        "inventory",
        "dashboard",
        "notifications",
        "reports",
      ],
      features: [],
      apiEnabled: false,
      maxUsers: 10,
      maxProducts: 100,
    };
  if (resource === "/company-profile/completeness") {
    completenessReads++;
    return {
      score: complete() ? 100 : 40,
      totalFields: 5,
      completedFields: complete() ? 5 : 2,
      complete: complete(),
      missingFields: complete() ? [] : ["RUC", "Dirección"],
    };
  }
  if (resource === "/notifications/unread-count") return { count: 0 };
  if (resource === "/sales")
    return [
      {
        id: "sale-a",
        saleNumber: "SALE-REGION-01",
        paymentMethod: "CASH",
        totalAmount: "39.00",
        status: "COMPLETED",
        createdAt: "2026-10-26T05:30:00Z",
      },
    ];
  if (resource === "/dashboard/tenant")
    return {
      salesScope: "COMPANY",
      salesToday: 1,
      revenueToday: 39,
      salesAnalytics: { totalSales: 1, totalRevenue: 39, averageTicket: 39 },
    };
  return [];
}

const backend = http.createServer(async (request, response) => {
  const resource = new URL(request.url, backendOrigin).pathname.replace(
    /^\/api/,
    "",
  );
  requests.push({ resource, method: request.method, platform: platform() });
  response.setHeader("Content-Type", "application/json");
  if (resource === "/notifications/preferences" && request.method === "PATCH") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    Object.assign(preferences, JSON.parse(Buffer.concat(chunks).toString()));
  }
  if (resource === "/companies/current" && request.method === "PATCH") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal("companyId" in body, false);
    assert.equal("currency" in body, false);
    if (failSave) {
      failSave = false;
      response.statusCode = 400;
      return response.end(
        JSON.stringify({
          message: "No se pudo guardar la región. Inténtalo nuevamente.",
        }),
      );
    }
    writes.push(body);
    Object.assign(company, body);
  }
  response.end(JSON.stringify(data(resource)));
});

async function main() {
  await new Promise((resolve, reject) => {
    backend.once("error", reject);
    backend.listen(4410, "127.0.0.1", resolve);
  });
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3320",
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
    assert.ok(ready, logs);
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      timezoneId: "UTC",
    });
    const cookie = () => ({
      name: "access_token",
      value: `e30.${Buffer.from(JSON.stringify({ ...user(), sub: user().id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`,
      url: origin,
    });
    await context.addCookies([cookie()]);
    await context.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/api/auth/me" && failClientAuth) {
        failClientAuth = false;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Sesión temporalmente no disponible",
          }),
        });
      }
      if (url.pathname.endsWith("/stream"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: ": heartbeat\n\n",
        });
      const response = await fetch(
        `${backendOrigin}${url.pathname}${url.search}`,
        {
          method: request.method(),
          headers: { "Content-Type": request.headers()["content-type"] || "" },
          body: request.postData() ?? undefined,
        },
      );
      return route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: await response.text(),
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) =>
      errors.push(`${page.url()}: ${error.message}`),
    );
    await page.goto(`${origin}/settings`);
    await page
      .getByRole("heading", { name: "Configuración", exact: true })
      .waitFor();
    const theme = page.getByRole("combobox", { name: "Tema", exact: true });
    await theme.selectOption("dark");
    await page.locator("html.dark").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("html.dark").waitFor();
    await page.waitForFunction(() => {
      const select = document.querySelector('select[aria-label="Tema"]');
      return select && !select.disabled && select.value === "dark";
    });
    assert.equal(await theme.inputValue(), "dark");
    await page.getByTitle(/^Tema:/).click();
    await page.waitForFunction(
      () =>
        document.querySelector('select[aria-label="Tema"]')?.value === "system",
    );
    assert.equal(await theme.inputValue(), "system");
    await theme.selectOption("light");
    await page.locator("html:not(.dark)").waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Exportar", exact: true }).count(),
      0,
    );
    console.log(
      "PASS: tema persistente y sincronizado con el encabezado, sin controles ficticios",
    );

    await page.goto(`${origin}/sales`);
    const sale = page.getByRole("link").filter({ hasText: "SALE-REGION-01" });
    await sale.waitFor();
    const salesHtml = await (
      await context.request.get(`${origin}/sales`)
    ).text();
    const serverSale = await page.evaluate(
      (html) =>
        new DOMParser()
          .parseFromString(html, "text/html")
          .querySelector('a[href="/sales/sale-a"]')?.textContent,
      salesHtml,
    );
    assert.equal(serverSale, await sale.textContent());
    assert.match(await sale.textContent(), /26\s+oct/);
    await page.goto(`${origin}/settings`);
    const zone = page.getByRole("combobox", {
      name: "Zona horaria",
      exact: true,
    });
    assert.equal(await zone.inputValue(), "America/Lima");
    failSave = true;
    await zone.selectOption("America/Mexico_City");
    await page
      .getByRole("button", { name: "Guardar región", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "No se pudo guardar la región" })
      .waitFor();
    assert.equal(company.timezone, "America/Lima");
    assert.equal(await zone.inputValue(), "America/Mexico_City");
    await page
      .getByRole("button", { name: "Guardar región", exact: true })
      .click();
    await page
      .getByText("Zona horaria del negocio actualizada", { exact: true })
      .waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document.querySelector('select[aria-label="Zona horaria"]')?.value ===
        "America/Mexico_City",
    );
    assert.equal(await zone.inputValue(), "America/Mexico_City");
    assert.deepEqual(writes[0], { timezone: "America/Mexico_City" });
    await page.goto(`${origin}/sales`);
    await sale.waitFor();
    assert.match(await sale.textContent(), /25\s+oct/);
    console.log(
      "PASS: región guardada en empresa, error recuperable y fechas visibles según la zona guardada",
    );

    await page.goto(`${origin}/settings`);
    await page.getByText("Perfil 40% completo", { exact: true }).waitFor();
    await page.getByRole("link", { name: /Datos de la empresa/ }).click();
    await page
      .getByLabel("Nombre de la Empresa", { exact: false })
      .fill(" Negocio actualizado ");
    await page.getByLabel("Razón Social", { exact: true }).fill("Negocio SAC");
    await page.getByLabel(/RUC/).fill("20123456789");
    await page
      .getByLabel("Dirección Fiscal", { exact: true })
      .fill("Av. Principal 123");
    await page
      .getByLabel("Correo Electrónico", { exact: true })
      .fill("negocio@example.test");
    await page.getByLabel("Teléfono", { exact: true }).fill("999123456");
    const previousCompleteness = completenessReads;
    await page
      .getByRole("button", { name: "Guardar Cambios", exact: true })
      .click();
    await page
      .getByText("Datos de la empresa actualizados correctamente", {
        exact: true,
      })
      .waitFor();
    assert.equal(company.name, "Negocio actualizado");
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await page.waitForURL("**/settings");
    await page
      .getByRole("heading", { name: "Configuración", exact: true })
      .waitFor();
    const deadline = Date.now() + 30_000;
    while (completenessReads <= previousCompleteness && Date.now() < deadline)
      await page.waitForTimeout(50);
    await page
      .getByText("Perfil 40% completo", { exact: true })
      .waitFor({ state: "hidden" });
    assert.ok(completenessReads > previousCompleteness);
    assert.equal(company.timezone, "America/Mexico_City");
    assert.equal(company.currency, "PEN");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    console.log(
      "PASS: datos de empresa persistidos e indicador de perfil actualizado sin perder la región",
    );

    failClientAuth = true;
    await page.goto(`${origin}/settings`);
    await page
      .getByRole("alert")
      .filter({ hasText: "No se pudo verificar la sesión" })
      .waitFor();
    await page
      .getByRole("button", { name: "Reintentar sesión", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !document.querySelector('select[aria-label="Zona horaria"]')?.disabled,
    );
    assert.equal(await zone.inputValue(), "America/Mexico_City");
    console.log(
      "PASS: una comprobación de sesión fallida se puede reintentar sin spinner permanente",
    );
    await page
      .getByRole("checkbox", { name: "Ventas registradas", exact: true })
      .uncheck();
    await page
      .getByRole("checkbox", { name: "Sonido de nuevas alertas", exact: true })
      .uncheck();
    await page
      .getByRole("button", { name: "Guardar alertas", exact: true })
      .click();
    await page.getByText("Preferencias guardadas.", { exact: true }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("checkbox", { name: "Ventas registradas", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Ventas registradas", exact: true })
        .isChecked(),
      false,
    );
    assert.equal(
      await page
        .getByRole("checkbox", {
          name: "Sonido de nuevas alertas",
          exact: true,
        })
        .isChecked(),
      false,
    );
    console.log(
      "PASS: preferencias de alertas guardadas por negocio y conservadas tras recargar",
    );

    const start = requests.length;
    roles = ["SUPER_ADMIN"];
    await context.clearCookies();
    await context.addCookies([cookie()]);
    await page.goto(`${origin}/settings`);
    await page.getByRole("combobox", { name: "Tema", exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("combobox", { name: "Zona horaria", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("link", { name: /Datos de la empresa/ }).count(),
      0,
    );
    assert.equal(
      requests
        .slice(start)
        .some(
          (request) =>
            request.platform &&
            ["/companies/current", "/company-profile/completeness"].includes(
              request.resource,
            ),
        ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: Super Admin conserva configuración global sin empresa ni plan personal",
    );
  } catch (error) {
    console.error(logs);
    console.error(
      JSON.stringify({
        requests,
        writes,
        company,
        failSave,
        errors: browser
          ? await Promise.all(
              browser
                .contexts()
                .flatMap((context) => context.pages())
                .map(async (page) => ({
                  url: page.url(),
                  text: await page
                    .locator("body")
                    .innerText()
                    .catch(() => ""),
                })),
            )
          : [],
      }),
    );
    throw error;
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
