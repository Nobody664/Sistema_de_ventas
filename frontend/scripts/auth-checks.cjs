const assert = require("node:assert/strict");

async function runAuthChecks(page, context, origin, user) {
  let authenticated = false;
  let coldUntil = Date.now() + 21000;
  let rejectLogin = false;
  let healthCalls = 0;
  let loginCalls = 0;
  const health = {
    status: "ok",
    service: "backend",
    checks: { database: { status: "ok" } },
  };
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  await context.clearCookies();
  await page.route("**/api/health/ready", async (route) => {
    healthCalls++;
    assert.equal(route.request().method(), "GET");
    assert.equal(route.request().postData(), null);
    const ready = Date.now() >= coldUntil;
    await route.fulfill({
      status: ready ? 200 : 503,
      contentType: "application/json",
      body: JSON.stringify(ready ? health : { status: "unavailable" }),
    });
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: authenticated ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(authenticated ? user : { message: "Unauthorized" }),
    }),
  );
  await page.route("**/api/auth/login", async (route) => {
    loginCalls++;
    assert.ok(
      Date.now() >= coldUntil,
      "Las credenciales solo se envían cuando el backend está listo",
    );
    if (rejectLogin)
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Credenciales incorrectas" }),
      });
    await new Promise((resolve) => setTimeout(resolve, 21000));
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Set-Cookie": `access_token=e30.${payload}.fixture; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({ user }),
    });
  });
  const fill = async () => {
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill(user.email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("fixture-password");
  };
  await page.goto(`${origin}/sign-in?redirect=/products`);
  await fill();
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "servidor estaba en reposo" })
    .waitFor();
  assert.equal(loginCalls, 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Conectando con el servidor…", exact: true })
      .isDisabled(),
    true,
  );
  await page.locator("form").evaluate((form) => form.requestSubmit());
  await page
    .getByRole("button", { name: "Verificando acceso…", exact: true })
    .waitFor({ timeout: 40000 });
  assert.equal(
    await page
      .getByRole("button", { name: "Cancelar espera", exact: true })
      .count(),
    0,
  );
  await page.waitForURL("**/products", { timeout: 45000 });
  await page.getByText("Galletas integrales", { exact: true }).waitFor();
  assert.equal(loginCalls, 1);
  assert.ok(healthCalls >= 2);
  assert.equal(
    await page
      .getByText("La solicitud tardó demasiado. Intenta nuevamente.", {
        exact: true,
      })
      .count(),
    0,
  );
  console.log(
    "PASS: servidor simulado en reposo y autenticación mayores a 20 s completan un único login con un clic",
  );

  authenticated = false;
  coldUntil = Number.POSITIVE_INFINITY;
  await context.clearCookies();
  await page.goto(`${origin}/sign-in?redirect=/products`);
  await fill();
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancelar espera", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .waitFor();
  const probesAfterCancel = healthCalls;
  await page.waitForTimeout(2000);
  assert.equal(healthCalls, probesAfterCancel);
  assert.equal(loginCalls, 1);
  console.log(
    "PASS: cancelar el arranque detiene los sondeos sin enviar credenciales ni repetir POST",
  );

  coldUntil = 0;
  rejectLogin = true;
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Credenciales incorrectas" })
    .waitFor();
  await page.waitForTimeout(1700);
  assert.equal(loginCalls, 2);
  assert.equal(
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .isEnabled(),
    true,
  );
  console.log(
    "PASS: un 401 muestra el error real y no dispara reintentos automáticos de login",
  );
}

module.exports = { runAuthChecks };
