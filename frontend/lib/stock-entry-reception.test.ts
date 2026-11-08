import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyStockEntryLine,
  receptionReferenceCost,
  stockEntryLineError,
} from "./stock-entry-reception";

const product = {
  id: "p",
  name: "Producto",
  costPrice: "2.50",
  presentations: [{ id: "pack", name: "Caja", factor: "12" }],
};
const line = {
  ...emptyStockEntryLine(),
  productId: "p",
  quantity: "3",
  unitCost: "2.5000",
};

test("el costo referencial se calcula para el producto y presentación seleccionados sin heredar costos ajenos", () => {
  assert.equal(receptionReferenceCost(product), "2.5");
  assert.equal(receptionReferenceCost(product, "pack"), "30");
  assert.equal(receptionReferenceCost({ ...product, costPrice: null }), "");
  assert.equal(receptionReferenceCost({ ...product, costPrice: "0" }), "0");
});

test("la recepción acepta cantidades y costos válidos y exige indicar cero explícitamente", () => {
  assert.equal(stockEntryLineError(line, product), null);
  assert.equal(
    stockEntryLineError({ ...line, quantity: "0.125", unitCost: "0" }, product),
    null,
  );
  assert.ok(stockEntryLineError({ ...line, unitCost: "" }, product));
  for (const quantity of ["0", "-1", "Infinity", "0.0001", ""])
    assert.ok(stockEntryLineError({ ...line, quantity }, product));
  for (const unitCost of ["-1", "Infinity", "1.00001"])
    assert.ok(stockEntryLineError({ ...line, unitCost }, product));
});

test("las filas se validan completas: presentación, lote y calendario", () => {
  assert.ok(
    stockEntryLineError({ ...line, presentationId: "foreign" }, product),
  );
  assert.ok(
    stockEntryLineError({ ...line, batchNumber: "a".repeat(81) }, product),
  );
  assert.ok(
    stockEntryLineError({ ...line, expiryDate: "2027-02-30" }, product),
  );
  assert.equal(
    stockEntryLineError(
      { ...line, batchNumber: "LOTE-A", expiryDate: "2028-02-29" },
      product,
    ),
    null,
  );
  assert.ok(stockEntryLineError(line, undefined));
});
