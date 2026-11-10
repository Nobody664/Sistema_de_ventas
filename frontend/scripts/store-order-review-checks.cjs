const assert = require("node:assert/strict");
const bwip = require("bwip-js");

async function runOrderReviewChecks({
  page,
  browser,
  origin,
  companyId,
  installApi,
  writes,
}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
  });
  await installApi(context);
  await context.addCookies([
    { name: "store_buyer_fixture", value: "buyer-a", url: origin },
  ]);
  const buyer = await context.newPage();
  const errors = [];
  buyer.on("pageerror", (error) => errors.push(error.message));
  try {
    await buyer.goto(`${origin}/tienda/bodega-central/pedidos/order-review`);
    await buyer
      .getByRole("heading", { name: "WEB-REVIEW", exact: true })
      .waitFor();
    await buyer
      .getByRole("button", { name: /^Novedades de tus pedidos:/ })
      .waitFor();
    await page.goto(`${origin}/comercio/pedidos/order-review`);
    await page
      .getByRole("heading", { name: "WEB-REVIEW", exact: true })
      .waitFor();
    await page
      .getByLabel("Acción", { exact: true })
      .selectOption("REJECT_PROOF");
    await page
      .getByLabel("Motivo para el comprador", { exact: true })
      .fill("No coincide el importe del comprobante");
    await page
      .getByRole("button", { name: "Confirmar acción", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Comprobante rechazado y motivo comunicado" })
      .waitFor();
    await buyer.evaluate(() => window.dispatchEvent(new Event("focus")));
    await buyer
      .getByRole("alert")
      .filter({ hasText: "Tu pago o comprobante fue rechazado" })
      .waitFor();
    await buyer
      .getByRole("button", { name: /^Novedades de tus pedidos:/ })
      .click();
    await buyer
      .getByRole("dialog")
      .getByText(/No coincide el importe del comprobante/)
      .waitFor();
    await buyer
      .getByRole("button", { name: "Marcar como leído", exact: true })
      .click();
    await buyer.keyboard.press("Escape");
    await buyer
      .getByRole("button", {
        name: "Novedades de tus pedidos: 0 sin leer",
        exact: true,
      })
      .waitFor();
    const buffer = await bwip.toBuffer({
      bcid: "qrcode",
      text: "comprobante corregido",
      scale: 2,
    });
    await buyer
      .getByLabel("Comprobante de pago", { exact: true })
      .setInputFiles({ name: "corregido.png", mimeType: "image/png", buffer });
    await buyer
      .getByRole("button", { name: "Enviar comprobante", exact: true })
      .click();
    await buyer
      .getByText("En revisión", { exact: true })
      .and(buyer.locator("span"))
      .waitFor();
    await page.evaluate(
      ({ companyId }) => {
        window.__commerceStreams
          .filter((stream) => !stream.closed)
          .at(-1)
          .onmessage({
            data: JSON.stringify({
              id: "proof-resubmitted",
              companyId,
              actionUrl: "/comercio/pedidos/order-review",
              type: "SYSTEM",
              isRead: false,
              title: "Nuevo comprobante",
              message: "Revisar comprobante",
              createdAt: new Date().toISOString(),
            }),
          });
      },
      { companyId },
    );
    await page.waitForFunction(
      () =>
        !document.querySelector(
          'select[aria-label="Acción"] option[value="REJECT_PROOF"]',
        ).disabled,
    );
    await page
      .getByLabel("Acción", { exact: true })
      .selectOption("APPROVE_PAYMENT");
    const beforeInvalid = writes.filter(
      (entry) => entry.resource === "/store-admin/orders/order-review",
    ).length;
    await page
      .getByLabel("Referencia real de la operación", { exact: true })
      .fill("12");
    await page
      .getByRole("button", { name: "Confirmar acción", exact: true })
      .click();
    assert.equal(
      writes.filter(
        (entry) => entry.resource === "/store-admin/orders/order-review",
      ).length,
      beforeInvalid,
    );
    await page
      .getByLabel("Referencia real de la operación", { exact: true })
      .fill("YAPE-CORREGIDO-001");
    await page
      .getByRole("button", { name: "Confirmar acción", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Cobro confirmado y pedido aceptado" })
      .waitFor();
    await buyer.evaluate(() => window.dispatchEvent(new Event("focus")));
    await buyer
      .getByText("Pagado", { exact: true })
      .and(buyer.locator("span"))
      .waitFor();
    await buyer
      .getByRole("button", { name: /^Novedades de tus pedidos:/ })
      .click();
    await buyer
      .getByRole("dialog")
      .getByText(/Pago aceptado y confirmado/)
      .waitFor();
    await buyer
      .getByRole("button", { name: "Marcar todos como leídos", exact: true })
      .click();
    await buyer.keyboard.press("Escape");
    await buyer
      .getByRole("button", {
        name: "Novedades de tus pedidos: 0 sin leer",
        exact: true,
      })
      .waitFor();
    assert.ok(
      await buyer.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await context.addCookies([
      { name: "store_buyer_fixture", value: "buyer-b", url: origin },
    ]);
    await buyer.evaluate(() => window.dispatchEvent(new Event("focus")));
    await buyer.waitForURL("**/ingresar");
    assert.equal(
      await buyer.getByText(/No coincide el importe del comprobante/).count(),
      0,
    );
    await buyer.goto(`${origin}/tienda/bodega-central/pedidos`);
    await buyer
      .getByRole("heading", { name: "Mis pedidos", exact: true })
      .waitFor();
    await buyer
      .getByRole("button", { name: /^Novedades de tus pedidos:/ })
      .click();
    await buyer
      .getByRole("dialog")
      .getByText("Todavía no hay avisos de pedidos.", { exact: true })
      .waitFor();
    assert.equal(await buyer.getByText(/WEB-REVIEW/).count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: rechazo con motivo, comprobante corregido, cobro confirmado, avisos automáticos al comprador y aislamiento al cambiar de cuenta.",
    );
  } finally {
    await context.close();
  }
}

module.exports = { runOrderReviewChecks };
