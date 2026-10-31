import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadBusinessData } from "./business-data-export";
import type { apiFetch } from "@/lib/api";
import { ApiError } from "@/lib/api";

const manifest = {
  format: "ventas.business-data",
  version: 1,
  company: { id: "company-a" },
  startedAt: "2026-10-28T00:00:00Z",
  collections: ["products", "sales"],
};

test("assembles paginated collections and exact decimal strings into a versioned JSON download", async () => {
  const requests: string[] = [];
  const request = (async (path: string) => {
    requests.push(path);
    if (path.endsWith("manifest")) return manifest;
    if (path.includes("/sales?"))
      return { collection: "sales", rows: [], nextCursor: null };
    if (path.includes("after="))
      return {
        collection: "products",
        rows: [{ id: "p2", cost: "0.1234" }],
        nextCursor: null,
      };
    return {
      collection: "products",
      rows: [{ id: "p1", cost: "900719925474.1234" }],
      nextCursor: "p1",
    };
  }) as typeof apiFetch;
  const messages: string[] = [];
  const result = await downloadBusinessData(
    "company-a",
    new AbortController().signal,
    (message) => messages.push(message),
    request,
    "en",
  );
  const data = JSON.parse(await result.text());
  assert.equal(data.manifest.version, 1);
  assert.equal(data.collections.products.length, 2);
  assert.equal(data.collections.products[0].cost, "900719925474.1234");
  assert.deepEqual(data.collections.sales, []);
  assert.equal(data.recordCount, 2);
  assert.equal(requests.length, 4);
  assert.ok(messages.every((message) => message.startsWith("Collection ")));
});

test("rejects cross-company manifests and repeated cursors rather than downloading partial or wrong data", async () => {
  const foreign = (async () => ({
    ...manifest,
    company: { id: "company-b" },
  })) as typeof apiFetch;
  await assert.rejects(
    downloadBusinessData(
      "company-a",
      new AbortController().signal,
      () => {},
      foreign,
    ),
    /no corresponde/,
  );
  const repeated = (async (path: string) =>
    path.endsWith("manifest")
      ? manifest
      : {
          collection: "products",
          rows: [{ id: "p1" }],
          nextCursor: "p1",
        }) as typeof apiFetch;
  await assert.rejects(
    downloadBusinessData(
      "company-a",
      new AbortController().signal,
      () => {},
      repeated,
    ),
    /no avanzó/,
  );
});

test("cancellation aborts between batches before producing a download", async () => {
  const controller = new AbortController();
  const request = (async () => {
    controller.abort();
    return manifest;
  }) as typeof apiFetch;
  await assert.rejects(
    downloadBusinessData("company-a", controller.signal, () => {}, request),
    { name: "AbortError" },
  );
});

test("a rate-limit pause stays visible and cancellable", async () => {
  const controller = new AbortController();
  const request = (async (path: string) => {
    if (path.endsWith("manifest")) return manifest;
    throw new ApiError("Too many requests", 429);
  }) as typeof apiFetch;
  const messages: string[] = [];
  await assert.rejects(
    downloadBusinessData(
      "company-a",
      controller.signal,
      (message) => {
        messages.push(message);
        if (message.includes("continuará")) controller.abort();
      },
      request,
    ),
    { name: "AbortError" },
  );
  assert.ok(messages.some((message) => message.includes("un minuto")));
});
