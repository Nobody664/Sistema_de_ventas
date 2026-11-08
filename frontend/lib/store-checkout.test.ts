import assert from "node:assert/strict";
import { test } from "node:test";
import { createStoreCheckoutKey } from "./store-checkout";
import { StoreApiError, storeApi } from "./store-api";

test("la confirmación genera claves válidas sin depender de crypto.randomUUID", () => {
  const source = {
    getRandomValues: (bytes: Uint8Array) => {
      bytes.fill(21);
      return bytes;
    },
  } as unknown as Crypto;
  const key = createStoreCheckoutKey(source);
  assert.match(key, /^[a-f0-9]{32}$/);
});

test("un fallo al preparar la clave de confirmación tiene un error recuperable", () => {
  assert.throws(
    () => createStoreCheckoutKey(null as unknown as Crypto),
    /Recarga la página/,
  );
});

test("una solicitud comercial lenta termina con un error visible y no repite el POST", async (t) => {
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init: RequestInit) => {
      calls++;
      return await new Promise<Response>((_resolve, reject) =>
        init.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        ),
      );
    },
  );
  await assert.rejects(
    storeApi("tienda-a", "orders", { quoteId: "quote" }, "POST", {
      timeoutMs: 10,
    }),
    (error: unknown) =>
      error instanceof StoreApiError &&
      error.status === 0 &&
      error.message.includes("tardó demasiado"),
  );
  assert.equal(calls, 1);
});
