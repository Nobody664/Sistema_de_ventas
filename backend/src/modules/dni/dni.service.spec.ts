import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException, HttpException } from "@nestjs/common";
import { DniService } from "./dni.service";
import {
  documentRequest,
  normalizeDni,
  normalizeRuc,
} from "./document-provider";
import { validateEnv } from "@/config/env";

const number = "00000001";
const provider = {
  document_number: number,
  first_name: "ANA",
  first_last_name: "PÉREZ",
  second_last_name: "LÓPEZ",
  full_name: "PÉREZ LÓPEZ ANA",
};

function fixture(
  options: {
    cache?: unknown;
    enabled?: boolean;
    missingToken?: boolean;
    exhausted?: boolean;
  } = {},
) {
  let consumed = 0;
  let writes = 0;
  let cacheReads = 0;
  const service = new DniService(
    new ConfigService({
      RENIEC_API_TOKEN: options.missingToken ? "" : "private-test-token",
    }),
    {
      get: async () => {
        cacheReads++;
        return options.cache ?? null;
      },
      set: async () => {
        writes++;
      },
    } as never,
    {
      assertDniAccess: async () => {
        if (options.enabled === false) throw new ForbiddenException();
      },
      consume: async () => {
        if (options.exhausted) throw new HttpException("quota", 429);
        consumed++;
      },
    } as never,
  );
  return {
    service,
    consumed: () => consumed,
    writes: () => writes,
    reads: () => cacheReads,
  };
}

test("normaliza nombres de Decolecta, camelCase y respuestas anidadas conservando ceros del DNI", () => {
  const result = normalizeDni(provider, number);
  assert.equal(result.dni, number);
  assert.equal(result.nombres, "ANA");
  assert.equal(result.apellidoPaterno, "PÉREZ");
  assert.equal(result.nombreCompleto, "ANA PÉREZ LÓPEZ");
  assert.deepEqual(normalizeDni({ data: provider }, number), result);
  assert.deepEqual(normalizeDni({ result: result }, number), result);
  assert.throws(() => normalizeDni({}, number));
  assert.throws(() =>
    normalizeDni({ ...provider, document_number: "99999999" }, number),
  );
});

test("RUC utiliza razón social y número_documento, no confunde el número de calle con el RUC", () => {
  const result = normalizeRuc(
    {
      numero_documento: "20111111111",
      razon_social: "EMPRESA S.A.C.",
      numero: "23",
      direccion: "Av. Prueba 23",
    },
    "20111111111",
  );
  assert.equal(result.nombre, "EMPRESA S.A.C.");
  assert.equal(result.ruc, "20111111111");
});

test("conserva variables del proveedor y construye query/Authorization como exige Decolecta", () => {
  const env = validateEnv({
    DATABASE_URL: "postgresql://test.invalid/db",
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    RENIEC_API_URL: "https://api.decolecta.com/v1/reniec/dni",
    RENIEC_API_TOKEN: "secret",
    RENIEC_QUERY_PARAM: "numero",
    RENIEC_AUTH_HEADER: "Authorization",
    RENIEC_TOKEN_PREFIX: "Bearer",
    RENIEC_TIMEOUT_MS: "12000",
    SUNAT_API_TOKEN: "ruc-secret",
  });
  const request = documentRequest(new ConfigService(env), "DNI", number);
  assert.equal(new URL(request.url).pathname, "/v1/reniec/dni");
  assert.equal(new URL(request.url).searchParams.get("numero"), number);
  assert.equal(request.headers.Authorization, "Bearer secret");
  assert.equal(request.timeout, 12000);
  assert.equal(request.url.includes("secret"), false);
  assert.throws(() =>
    documentRequest(
      new ConfigService({ RENIEC_API_URL: "http://localhost/dni" }),
      "DNI",
      number,
    ),
  );
});

test("una respuesta de nombres correcta se devuelve y cachea una vez ante solicitudes concurrentes", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      assert.equal(new URL(url).searchParams.get("numero"), number);
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer private-test-token",
      );
      assert.equal(init?.redirect, "error");
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json(provider);
    },
  );
  const value = fixture();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => value.service.findByDni(number, "company")),
  );
  assert.ok(results.every((row) => row.nombreCompleto === "ANA PÉREZ LÓPEZ"));
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(value.consumed(), 1);
  assert.equal(value.writes(), 1);
});

test("la caché valida nombres y no puede evadir el permiso o el pago vigente", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json(provider),
  );
  const cached = fixture({ cache: normalizeDni(provider, number) });
  assert.equal(
    (await cached.service.findByDni(number, "company")).nombres,
    "ANA",
  );
  assert.equal(cached.consumed(), 0);
  const denied = fixture({
    enabled: false,
    cache: normalizeDni(provider, number),
  });
  await assert.rejects(denied.service.findByDni(number, "company"));
  assert.equal(denied.reads(), 0);
  assert.equal(fetch.mock.callCount(), 0);
  await assert.rejects(cached.service.findByDni(number, null));
});

test("un HTTP 200 sin nombres no se marca como documento encontrado ni se cachea", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ dni: number }),
  );
  const value = fixture();
  await assert.rejects(
    value.service.findByDni(number, "company"),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 502,
  );
  assert.equal(value.writes(), 0);
  assert.equal(value.consumed(), 1);
});

test("cuota agotada y configuración incompleta no realizan llamadas al proveedor", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json(provider),
  );
  await assert.rejects(
    fixture({ exhausted: true }).service.findByDni(number, "company"),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 429,
  );
  const missing = fixture({ missingToken: true });
  await assert.rejects(
    missing.service.findByDni(number, "company"),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 503,
  );
  assert.equal(missing.consumed(), 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test("preserva 404 y timeout y cobra solo el intento externo sin guardar resultados vacíos", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 404 }),
  );
  const value = fixture();
  await assert.rejects(
    value.service.findByDni(number, "company"),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 404,
  );
  fetch.mock.restore();
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("timeout", "TimeoutError");
  });
  await assert.rejects(
    value.service.findByDni(number, "company"),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 504,
  );
  assert.equal(value.consumed(), 2);
  assert.equal(value.writes(), 0);
});
