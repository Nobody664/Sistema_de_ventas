import assert from "node:assert/strict";
import test from "node:test";
import { storeApi } from "./store-api";

test("una lectura comercial cancelada no inicia solicitudes ni refresh", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({});
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      storeApi("tienda-a", "me/notifications/feed", undefined, undefined, {
        signal: controller.signal,
      }),
    (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(requests, 0);
});
test("cancelar la lectura durante su cuerpo impide devolver datos de la sesión anterior", async (t) => {
  const controller = new AbortController();
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          controller.abort();
          return { accountId: "old-account", data: [] };
        },
      }) as Response,
  );
  await assert.rejects(
    () =>
      storeApi("tienda-a", "me/notifications/feed", undefined, undefined, {
        signal: controller.signal,
      }),
    (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError",
  );
});
