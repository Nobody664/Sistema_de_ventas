import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultAppearance,
  parseAppearance,
  studioDefinition,
} from "./studio.schemas";

test("la apariencia no admite HTML, CSS, URLs ni campos de editor arbitrarios", () => {
  assert.equal(parseAppearance(defaultAppearance).schemaVersion, 1);
  for (const data of [
    { ...defaultAppearance, headline: "<script>" },
    { ...defaultAppearance, css: "body{}" },
    { ...defaultAppearance, themePreset: "url(external)" },
    { ...defaultAppearance, logoAssetId: "https://external.test/image" },
  ])
    assert.throws(() => parseAppearance(data));
});
test("las vistas rechazan datos personales, SQL y filtros de otros recursos", () => {
  assert.deepEqual(
    studioDefinition("ORDERS", { layout: "board", queue: "review" }),
    { layout: "board", queue: "review" },
  );
  for (const data of [
    { layout: "list", q: "ana@example.test" },
    { layout: "list", columns: ["passwordHash"] },
    { layout: "list", sql: "SELECT *" },
    { layout: "list", publication: "published" },
  ])
    assert.throws(() => studioDefinition("ORDERS", data));
  assert.throws(() => studioDefinition("UNKNOWN", { layout: "list" }));
});
