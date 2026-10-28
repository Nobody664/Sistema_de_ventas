import assert from "node:assert/strict";
import test from "node:test";
import { purchaseDecimal, purchaseOrderPayload } from "./purchase-order";

test("prepara una orden con cantidades base fraccionarias y costos desconocidos explícitos", () => {
  const result = purchaseOrderPayload("supplier", " OC-01 ", " ", [
    {
      productId: "p1",
      name: "Harina",
      baseUnit: "KG",
      quantity: "1.375",
      unitCost: "2.1250",
    },
    {
      productId: "p2",
      name: "Caja",
      baseUnit: "UNIT",
      quantity: "2",
      unitCost: "",
    },
  ]);
  assert.equal(result.reference, "OC-01");
  assert.equal(result.notes, undefined);
  assert.equal(result.items[0].requestedQuantity, 1.375);
  assert.equal(result.items[0].unitCost, 2.125);
  assert.equal(result.items[1].unitCost, undefined);
});

test("no confunde costo cero con costo vacío ni acepta precisión inválida", () => {
  assert.equal(purchaseDecimal("0", 4, 0, 100, "Costo"), 0);
  assert.throws(() => purchaseDecimal("", 4, 0, 100, "Costo"));
  assert.throws(() => purchaseDecimal("1.23456", 4, 0, 100, "Costo"));
  assert.throws(() => purchaseDecimal("NaN", 4, 0, 100, "Costo"));
});

test("bloquea productos repetidos y unidades discretas fraccionadas", () => {
  const item = {
    productId: "p1",
    name: "Caja",
    baseUnit: "UNIT",
    quantity: "1",
    unitCost: "0",
  };
  assert.throws(() => purchaseOrderPayload("supplier", "", "", [item, item]));
  assert.throws(() =>
    purchaseOrderPayload("supplier", "", "", [{ ...item, quantity: "1.5" }]),
  );
  assert.throws(() => purchaseOrderPayload("", "", "", [item]));
});
