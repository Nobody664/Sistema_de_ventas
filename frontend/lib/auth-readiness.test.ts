import assert from "node:assert/strict";
import { test } from "node:test";
import { login } from "./api/auth";
import { ApiError, apiFetch } from "./api/client";
import { waitForAuthBackend } from "./auth-readiness";

const ready = {
  status: "ok",
  service: "backend",
  checks: { database: { status: "ok" } },
};
const user = {
  id: "owner",
  email: "owner@example.test",
  fullName: "Owner",
  roles: ["COMPANY_ADMIN"],
  companyId: "company",
};

test("espera salud real y base de datos antes de enviar un único POST de credenciales", async (t) => {
  const requests: { url: string; init?: RequestInit }[] = [];
  let probes = 0;
  const stages: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === "/api/health/ready") {
        probes++;
        assert.equal(init?.body, undefined);
        assert.equal(init?.credentials, "omit");
        return probes === 1
          ? Response.json({ status: "unavailable" }, { status: 503 })
          : Response.json(ready);
      }
      assert.equal(url, "/api/auth/login");
      assert.equal(probes, 2);
      assert.equal(init?.method, "POST");
      return Response.json({ user });
    },
  );
  const response = await login(
    { email: user.email, password: "example-password" },
    { onStage: (stage) => stages.push(stage) },
  );
  assert.equal(response.user.id, user.id);
  assert.equal(
    requests.filter((request) => request.url === "/api/auth/login").length,
    1,
  );
  assert.deepEqual(stages, ["connecting", "authenticating"]);
});

test("HTML de arranque o una dependencia crítica caída no se confunden con servidor listo", async (t) => {
  const responses = [
    new Response("<html>Starting</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    Response.json(
      {
        ...ready,
        status: "unavailable",
        checks: { database: { status: "error" } },
      },
      { status: 503 },
    ),
    Response.json({ ...ready, status: "degraded" }),
  ];
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => responses.shift()!,
  );
  await waitForAuthBackend({
    timeoutMs: 200,
    retryDelayMs: 1,
    requestTimeoutMs: 50,
  });
  assert.equal(fetch.mock.callCount(), 3);
});

test("una configuración inexistente o rate limit detienen la preparación sin reintentar credenciales", async (t) => {
  for (const status of [401, 403, 404, 429]) {
    const fetch = t.mock.method(globalThis, "fetch", async () =>
      Response.json({}, { status }),
    );
    await assert.rejects(
      waitForAuthBackend({ timeoutMs: 100 }),
      (error: unknown) => error instanceof ApiError && error.status === status,
    );
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test("el arranque tiene un presupuesto acotado y nunca envía contraseña al endpoint de salud", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      assert.equal(url, "/api/health/ready");
      assert.equal(init?.body, undefined);
      return Response.json({ status: "unavailable" }, { status: 503 });
    },
  );
  await assert.rejects(
    waitForAuthBackend({ timeoutMs: 15, requestTimeoutMs: 5, retryDelayMs: 2 }),
    (error: unknown) =>
      error instanceof ApiError && error.code === "BACKEND_STARTUP_TIMEOUT",
  );
  assert.ok(fetch.mock.callCount() > 0);
});

test("cancelar durante el arranque no llega a enviar el POST de login", async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      assert.equal(url, "/api/health/ready");
      calls++;
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        ),
      );
    },
  );
  const request = login(
    { email: user.email, password: "example-password" },
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(calls, 1);
});

test("credenciales inválidas no disparan reintentos de autenticación ni refresh", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return url.endsWith("/ready")
      ? Response.json(ready)
      : Response.json({ message: "Invalid credentials." }, { status: 401 });
  });
  await assert.rejects(
    login({ email: user.email, password: "wrong-password" }),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  assert.deepEqual(urls, ["/api/health/ready", "/api/auth/login"]);
});

test("el timeout HTTP también protege la lectura del cuerpo después de recibir cabeceras", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init?: RequestInit) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener(
              "abort",
              () => controller.error(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  );
  await assert.rejects(
    apiFetch("/slow-body", { timeoutMs: 10, skipRefresh: true }),
    (error: unknown) => error instanceof ApiError && error.code === "TIMEOUT",
  );
});

test("una señal cancelada previamente no inicia solicitudes HTTP", async (t) => {
  const controller = new AbortController();
  controller.abort();
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({}),
  );
  await assert.rejects(
    apiFetch("/auth/login", {
      method: "POST",
      body: "{}",
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(fetch.mock.callCount(), 0);
});
