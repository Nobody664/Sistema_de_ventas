import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { apiFetch } from "./api/client";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("las mutaciones sin cuerpo envían JSON para cumplir la protección CSRF", async () => {
  for (const method of ["DELETE", "POST", "PATCH", "PUT"]) {
    globalThis.fetch = async (_input, init) => {
      assert.equal(
        new Headers(init?.headers).get("Content-Type"),
        "application/json",
      );
      assert.equal(init?.body, undefined);
      assert.equal(init?.credentials, "include");
      return new Response(null, { status: 204 });
    };
    await apiFetch("/products/categories/category-1", { method });
  }
});

test("las lecturas no reciben cabeceras JSON innecesarias y se conservan las cabeceras explícitas", async () => {
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.has("Content-Type"), false);
    assert.equal(headers.get("X-Request-Id"), "request-1");
    return Response.json([]);
  };
  await apiFetch("/products/categories", {
    headers: { "X-Request-Id": "request-1" },
  });
});

test("FormData conserva su contrato y una cabecera de contenido explícita no se sobrescribe", async () => {
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).has("Content-Type"), false);
    return new Response(null, { status: 204 });
  };
  await apiFetch("/upload", { method: "POST", body: new FormData() });
  globalThis.fetch = async (_input, init) => {
    assert.equal(
      new Headers(init?.headers).get("Content-Type"),
      "application/json; charset=utf-8",
    );
    return new Response(null, { status: 204 });
  };
  await apiFetch("/resource", {
    method: "DELETE",
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});
