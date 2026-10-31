import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  barcodeLookupCandidates,
  isValidGtin,
  toGtin14,
} from "./barcode.helper";

describe("barcode helper", () => {
  it("validates GTIN check digits", () => {
    assert.equal(isValidGtin("09520123456788"), true);
    assert.equal(isValidGtin("7701234567897"), true);
    assert.equal(isValidGtin("09520123456780"), false);
    assert.equal(isValidGtin("abc"), false);
    assert.equal(toGtin14("7701234567897"), "07701234567897");
    assert.equal(toGtin14("09520123456780"), null);
  });

  it("looks up EAN-13 and GTIN-14 representations together", () => {
    assert.deepEqual(barcodeLookupCandidates("7701234567897"), [
      "7701234567897",
      "07701234567897",
    ]);
    assert.deepEqual(barcodeLookupCandidates("07701234567897"), [
      "07701234567897",
      "7701234567897",
    ]);
  });

  it("includes the UPC-A and EAN-8 forms of a GTIN", () => {
    assert.ok(
      barcodeLookupCandidates("012345678905").includes("00012345678905"),
    );
    assert.ok(barcodeLookupCandidates("12345670").includes("00000012345670"));
  });

  it("keeps internal codes untouched", () => {
    assert.deepEqual(barcodeLookupCandidates("INT-00123"), ["INT-00123"]);
    assert.deepEqual(barcodeLookupCandidates("   "), []);
  });
});
