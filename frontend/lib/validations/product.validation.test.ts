import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductSchema, updateProductSchema } from "./product.validation";

const base = {
  name: "Atún en conserva",
  costPrice: 5,
  salePrice: 8,
  stockQuantity: 0,
  minStock: 5,
  baseUnit: "UNIT" as const,
  expiryProfile: "STANDARD" as const,
};

test("loads both schemas without failing on refinement-aware omit", () => {
  assert.equal(typeof createProductSchema.safeParse, "function");
  assert.equal(typeof updateProductSchema.safeParse, "function");
});

test("accepts a standard product on create and update", () => {
  assert.equal(createProductSchema.safeParse(base).success, true);
  assert.equal(
    updateProductSchema.safeParse({ ...base, stockQuantity: undefined })
      .success,
    true,
  );
});

test("requires warning days only for a custom expiry profile", () => {
  assert.equal(
    createProductSchema.safeParse({ ...base, expiryProfile: "CUSTOM" }).success,
    false,
  );
  assert.equal(
    createProductSchema.safeParse({
      ...base,
      expiryProfile: "CUSTOM",
      expiryWarningDays: 90,
    }).success,
    true,
  );
  assert.equal(
    createProductSchema.safeParse({
      ...base,
      expiryProfile: "LONG_LIFE",
      expiryWarningDays: 90,
    }).success,
    false,
  );
});

test("rejects out-of-range warning days", () => {
  for (const expiryWarningDays of [0, -1, 1.5, 3651]) {
    assert.equal(
      createProductSchema.safeParse({
        ...base,
        expiryProfile: "CUSTOM",
        expiryWarningDays,
      }).success,
      false,
    );
  }
});
