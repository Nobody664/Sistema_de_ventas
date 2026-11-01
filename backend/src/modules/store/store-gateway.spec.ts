import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { storeRedirect, storeWebhookId } from "./store-gateway";

test("la firma comercial vincula recurso, request y timestamp y rechaza ambigüedad o replay vencido", () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", "secret")
    .update(`id:123;request-id:request-1;ts:${ts};`)
    .digest("hex");
  const headers = {
    "x-signature": `ts=${ts},v1=${signature}`,
    "x-request-id": "request-1",
  };
  assert.equal(storeWebhookId("secret", headers, { "data.id": "123" }), "123");
  assert.throws(() => storeWebhookId("other", headers, { "data.id": "123" }));
  assert.throws(() =>
    storeWebhookId("secret", headers, {
      "data.id": "123",
      data: { id: "456" },
    }),
  );
  assert.throws(() => storeWebhookId("secret", headers, { "data.id": "456" }));
  assert.throws(() =>
    storeWebhookId(
      "secret",
      { ...headers, "x-request-id": "changed" },
      { "data.id": "123" },
    ),
  );
  assert.throws(() =>
    storeWebhookId(
      "secret",
      { ...headers, "x-signature": "ts=1000000000,v1=" + signature },
      { "data.id": "123" },
    ),
  );
});

test("el retorno de checkout solo admite HTTPS del proveedor sin credenciales", () => {
  assert.match(
    storeRedirect(
      "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=test",
    ),
    /^https:/,
  );
  for (const url of [
    "http://www.mercadopago.com.pe/pay",
    "https://mercadopago.com.pe.attacker.test/pay",
    "https://user:pass@www.mercadopago.com.pe/pay",
    "javascript:alert(1)",
    "https://localhost/pay",
  ])
    assert.throws(() => storeRedirect(url));
});
