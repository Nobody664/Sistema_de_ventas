import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { fetchServerApiResult } from "./server-api-result";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("una respuesta vacía de Nest solo es ausencia válida con contrato opcional explícito", async () => {
  globalThis.fetch = async () => new Response(null, { status: 200 });
  assert.deepEqual(await fetchServerApiResult("https://api.test", "token"), {
    ok: false,
    status: 200,
    kind: "invalid_response",
  });
  assert.deepEqual(
    await fetchServerApiResult("https://api.test", "token", {
      allowEmpty: true,
    }),
    {
      ok: true,
      status: 200,
      data: null,
    },
  );
});

test("un contrato opcional sigue rechazando permisos insuficientes, errores HTTP y JSON inválido", async () => {
  for (const [status, kind] of [
    [403, "forbidden"],
    [500, "http"],
  ] as const) {
    globalThis.fetch = async () => new Response(null, { status });
    assert.deepEqual(
      await fetchServerApiResult("https://api.test", "token", {
        allowEmpty: true,
      }),
      {
        ok: false,
        status,
        kind,
      },
    );
  }
  globalThis.fetch = async () => new Response("<html>error</html>");
  assert.deepEqual(
    await fetchServerApiResult("https://api.test", "token", {
      allowEmpty: true,
    }),
    {
      ok: false,
      status: 200,
      kind: "invalid_response",
    },
  );
});

test("una lista vacía válida es distinta de 401, 403, 404 y 500", async () => {
  for (const [status, kind] of [
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [500, "http"],
  ] as const) {
    globalThis.fetch = async () => new Response("", { status });
    assert.deepEqual(await fetchServerApiResult("https://api.test", "token"), {
      ok: false,
      status,
      kind,
    });
  }
  globalThis.fetch = async () => Response.json([]);
  assert.deepEqual(await fetchServerApiResult("https://api.test", "token"), {
    ok: true,
    status: 200,
    data: [],
  });
});

test("distingue red caída y JSON inválido sin convertirlos en datos vacíos", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("offline");
  };
  assert.deepEqual(await fetchServerApiResult("https://api.test", "token"), {
    ok: false,
    status: 0,
    kind: "network",
  });
  globalThis.fetch = async () => new Response("<html>error</html>");
  assert.deepEqual(await fetchServerApiResult("https://api.test", "token"), {
    ok: false,
    status: 200,
    kind: "invalid_response",
  });
});

test("sin credencial no solicita datos; 204 y null explícito sí son ausencia válida", async () => {
  globalThis.fetch = async () => {
    throw new Error("No debe consultar");
  };
  assert.deepEqual(await fetchServerApiResult("https://api.test"), {
    ok: false,
    status: 401,
    kind: "unauthorized",
  });
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.deepEqual(await fetchServerApiResult("https://api.test", "token"), {
    ok: true,
    status: 204,
    data: null,
  });
  globalThis.fetch = async () => Response.json(null);
  assert.deepEqual(await fetchServerApiResult("https://api.test", "token"), {
    ok: true,
    status: 200,
    data: null,
  });
});
