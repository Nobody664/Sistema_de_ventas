import assert from "node:assert/strict";
import test from "node:test";
import {
  businessDateInputValue,
  businessDateToInstant,
  formatBusinessDate,
} from "./business-date";

test("conserva el día contable de Lima al guardar y mostrar un instante", () => {
  const instant = businessDateToInstant("2026-10-23");
  assert.equal(instant, "2026-10-23T05:00:00.000Z");
  assert.equal(businessDateInputValue(instant), "2026-10-23");
  assert.equal(formatBusinessDate(instant), "23/10/2026");
});

test("el día actual usa Lima incluso al cruzar medianoche UTC y valida el calendario", () => {
  assert.equal(businessDateInputValue("2026-11-01T02:00:00Z"), "2026-10-31");
  assert.throws(() => businessDateToInstant("2026-02-30"));
  assert.throws(() => businessDateToInstant("23/10/2026"));
});
