import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXPIRY_PROFILE_OPTIONS,
  EXPIRY_STAGE_LABELS,
  expiryDaysLabel,
  expiryProfileOption,
  expiryStageTone,
  expiryWarningLabel,
} from "./product-expiry";

test("describes every expiry profile with its own warning window", () => {
  assert.equal(EXPIRY_PROFILE_OPTIONS.length, 4);
  assert.equal(expiryProfileOption("LONG_LIFE").label, "Larga duración");
  assert.match(expiryProfileOption("LONG_LIFE").description, /Conservas/);
  assert.equal(expiryWarningLabel("PERISHABLE"), "3 días antes");
  assert.equal(expiryWarningLabel("STANDARD"), "30 días antes");
  assert.equal(expiryWarningLabel("LONG_LIFE"), "3 meses antes");
  assert.equal(expiryWarningLabel("CUSTOM", 45), "45 días antes");
  assert.equal(expiryWarningLabel("CUSTOM", 1), "1 día antes");
  assert.equal(expiryWarningLabel("CUSTOM", null), "Define los días de aviso");
});

test("falls back to the standard profile for unknown values", () => {
  assert.equal(expiryProfileOption("UNKNOWN" as never).value, "STANDARD");
});

test("labels each stage and keeps expired notices distinct from near-expiry ones", () => {
  assert.deepEqual(Object.keys(EXPIRY_STAGE_LABELS), [
    "EARLY",
    "WARNING",
    "URGENT",
    "TODAY",
    "EXPIRED",
  ]);
  assert.match(expiryStageTone("EXPIRED"), /red/);
  assert.match(expiryStageTone("URGENT"), /orange/);
  assert.match(expiryStageTone("EARLY"), /blue/);
  assert.match(expiryStageTone(null), /slate/);
  assert.equal(expiryDaysLabel(-2), "Venció hace 2 día(s)");
  assert.equal(expiryDaysLabel(0), "Vence hoy");
  assert.equal(expiryDaysLabel(1), "Vence en 1 día(s)");
  assert.equal(expiryDaysLabel(null), "Sin fecha de vencimiento");
});
