import assert from "node:assert/strict";
import test from "node:test";
import { safeRedirect } from "./safe-redirect";

test("solo permite rutas internas y conserva query y hash codificados", () => {
  assert.equal(safeRedirect("/sales?page=2#history"), "/sales?page=2#history");
  assert.equal(
    safeRedirect("/customers?search=Ana%20Paz"),
    "/customers?search=Ana%20Paz",
  );
  assert.equal(safeRedirect("/sales/../products"), "/products");
});

test("rechaza escapes externos, controles, variantes codificadas y bucles de login", () => {
  assert.equal(safeRedirect("/sales/..//evil.test"), "/dashboard");
  for (const target of [
    null,
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%5cevil.test",
    "/%255cevil.test",
    "/%2f%2fevil.test",
    "/%0aevil.test",
    "/sign-in?redirect=/sales",
    "/%73ign-in",
    "/sales/../sign-in",
    "/sign-up",
    "/%ZZ",
  ]) {
    assert.equal(safeRedirect(target), "/dashboard", String(target));
  }
});
