import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BarcodeResolutionService } from "./barcode-resolution.service";

const GTIN = "07701234567897";

function fixture(
  options: {
    enabled?: boolean;
    product?: object;
    cache?: object;
    companies?: string;
    plans?: string;
  } = {},
) {
  const writes: unknown[] = [];
  const config: Record<string, string> = {
    BARCODE_ENRICHMENT_ENABLED: options.enabled === false ? "false" : "true",
    BARCODE_ENRICHMENT_COMPANY_IDS: options.companies ?? "",
    BARCODE_ENRICHMENT_PLAN_CODES: options.plans ?? "",
  };
  const service = new BarcodeResolutionService(
    {
      findByBarcode: async (company: string) => {
        assert.equal(company, "company-a");
        return options.product ?? null;
      },
    } as never,
    {
      barcodeLookupCache: {
        findUnique: async (args: unknown) => {
          assert.deepEqual(args, {
            where: { gtin_provider: { gtin: GTIN, provider: "openfoodfacts" } },
          });
          return options.cache ?? null;
        },
        upsert: async (args: unknown) => {
          writes.push(args);
        },
      },
    } as never,
    { get: (key: string) => config[key] } as never,
    { getCapabilities: async () => ({ planCode: "PRO" }) } as never,
  );
  return { service, writes };
}

test("prioriza catálogo del tenant y no consulta proveedores al estar deshabilitado o fuera del alcance", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("No debe consultar");
  });
  const product = { id: "local", name: "Nombre propio" };
  assert.equal(
    (await fixture({ product }).service.resolve("company-a", "7701234567897"))
      .product,
    product,
  );
  assert.equal(
    (
      await fixture({ enabled: false }).service.resolve(
        "company-a",
        "7701234567897",
      )
    ).source,
    "none",
  );
  assert.equal(
    (
      await fixture({ companies: "company-b" }).service.resolve(
        "company-a",
        "7701234567897",
      )
    ).source,
    "none",
  );
  assert.equal(
    (await fixture().service.resolve("company-a", "https://localhost/secret"))
      .source,
    "none",
  );
  assert.equal(fetch.mock.callCount(), 0);
});

test("consulta únicamente Open Food Facts con timeout, sin redirecciones, y guarda solo metadatos públicos", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(new URL(url).origin, "https://world.openfoodfacts.org");
    assert.match(url, /7701234567897\.json/);
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(JSON.stringify(init).includes("company-a"), false);
    return Response.json({
      status: 1,
      product: {
        product_name_es: "Café",
        brands: "Marca",
        quantity: "200 g",
        price: 999,
        expiry: "2027-01-01",
        stock: 100,
      },
    });
  });
  const { service, writes } = fixture({ plans: "PRO" });
  const result = await service.resolve("company-a", "7701234567897");
  assert.deepEqual(result.suggestion, {
    name: "Café",
    brand: "Marca",
    quantity: "200 g",
    description: "Marca · 200 g",
  });
  assert.equal(result.source, "openfoodfacts");
  assert.equal(writes.length, 1);
  assert.equal(JSON.stringify(writes).includes("expiry"), false);
  assert.equal(JSON.stringify(writes).includes("price"), false);
});

test("reutiliza caché positiva y negativa sin red y no usa entradas vencidas", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ status: 0 }),
  );
  const cache = {
    payload: { product_name: "En caché" },
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
  };
  assert.equal(
    (await fixture({ cache }).service.resolve("company-a", "7701234567897"))
      .suggestion?.name,
    "En caché",
  );
  assert.equal(
    (
      await fixture({ cache: { ...cache, payload: {} } }).service.resolve(
        "company-a",
        "7701234567897",
      )
    ).suggestion,
    null,
  );
  assert.equal(fetch.mock.callCount(), 0);
  const { service, writes } = fixture({
    cache: { ...cache, expiresAt: new Date(0) },
  });
  assert.equal(
    (await service.resolve("company-a", "7701234567897")).suggestion,
    null,
  );
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(writes.length, 1);
});

test("fallos de proveedor, JSON inválido y exceso de tamaño dejan disponible el formulario sin envenenar caché", async (t) => {
  for (const response of [
    new Response("oops", { status: 503 }),
    new Response("invalid"),
    new Response("x".repeat(65537)),
  ]) {
    const fetch = t.mock.method(globalThis, "fetch", async () => response);
    const { service, writes } = fixture();
    const result = await service.resolve("company-a", "7701234567897");
    assert.equal(result.source, "none");
    assert.equal(result.suggestion, null);
    assert.equal(writes.length, 0);
    fetch.mock.restore();
  }
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Timeout", "TimeoutError");
  });
  assert.equal(
    (await fixture().service.resolve("company-a", "7701234567897")).source,
    "none",
  );
});

test("deduplica consultas simultáneas del mismo GTIN", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json({ status: 1, product: { product_name: "Café" } });
  });
  const { service } = fixture();
  const results = await Promise.all([
    service.resolve("company-a", "7701234567897"),
    service.resolve("company-a", GTIN),
  ]);
  assert.equal(fetch.mock.callCount(), 1);
  assert.ok(results.every((result) => result.suggestion?.name === "Café"));
});
