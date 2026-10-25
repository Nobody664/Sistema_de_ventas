import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampSaleQuantity,
  formatSaleQuantity,
  maxSaleQuantity,
  normalizeSaleQuantity,
  quantityStep,
  roundMoney,
} from "./sale-quantity";

describe("sale quantity helpers", () => {
  it("uses thousandths for base weight and volume units", () => {
    assert.equal(quantityStep("KG"), 0.001);
    assert.equal(quantityStep("lt"), 0.001);
    assert.equal(quantityStep("MT"), 0.001);
    assert.equal(quantityStep("UNIT"), 1);
  });

  it("counts presentations as whole units", () => {
    assert.equal(quantityStep("KG", "presentation-1"), 1);
    assert.equal(maxSaleQuantity(12.5, 5, "KG", "presentation-1"), 2);
    assert.equal(maxSaleQuantity(12.5, 1, "KG"), 12.5);
  });

  it("keeps base weights below one sellable and rejects partial units", () => {
    assert.equal(maxSaleQuantity(0.4, 1, "KG"), 0.4);
    assert.equal(normalizeSaleQuantity(1, 0.4, 1, "KG"), 0.4);
    assert.equal(maxSaleQuantity(0.4, 1, "UNIT"), 0);
  });

  it("clamps manual quantities to stock and precision", () => {
    assert.equal(normalizeSaleQuantity(2.5009, 2.5, 1, "KG"), 2.5);
    assert.equal(normalizeSaleQuantity(9, 2.5, 1, "KG"), 2.5);
    assert.equal(normalizeSaleQuantity(1.9, 10, 1, "UNIT"), 1);
    assert.equal(normalizeSaleQuantity(0, 10, 1, "UNIT"), 0);
  });

  it("keeps non-negative step values and formats minimal decimals", () => {
    assert.equal(clampSaleQuantity(0.5, 0.001, 1), 0.5);
    assert.equal(formatSaleQuantity(1, 1), "1");
    assert.equal(formatSaleQuantity(0.5, 0.001), "0.5");
  });

  it("rounds monetary values to two decimals", () => {
    assert.equal(roundMoney(1.005), 1.01);
    assert.equal(roundMoney(10.05 * 0.1), 1.01);
  });
});
