import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barcodeFormatLabel,
  isValidGtin,
  normalizeRaw,
  parseBarcode,
  parseDigitalLink,
  parseGs1,
  parseGs1Date,
  parseGs1Decimal,
  toGtin14,
} from "./index";

const GTIN = "09520123456788";

test("validates GTIN check digits and normalizes to GTIN-14", () => {
  assert.equal(isValidGtin(GTIN), true);
  assert.equal(isValidGtin("7701234567897"), true);
  assert.equal(isValidGtin("012345678905"), true);
  assert.equal(isValidGtin("12345670"), true);
  assert.equal(isValidGtin("09520123456780"), false);
  assert.equal(isValidGtin("abc"), false);
  assert.equal(toGtin14("7701234567897"), "07701234567897");
  assert.equal(toGtin14("09520123456780"), null);
});

test("normalizes AIM prefixes, FNC1 and human readable GS1", () => {
  assert.equal(normalizeRaw("]C10109520123456788"), "0109520123456788");
  assert.equal(
    normalizeRaw("0109520123456788\u001d17261231"),
    "0109520123456788|17261231",
  );
  assert.equal(
    normalizeRaw("(01)09520123456788 (17)261231 (10)LOT-1"),
    "0109520123456788|17261231|10LOT-1",
  );
});

test("parses a plain EAN-13 without inventing product data", () => {
  const parsed = parseBarcode("7701234567897", "ean_13");
  assert.equal(parsed.kind, "GTIN");
  assert.equal(parsed.gtin, "07701234567897");
  assert.equal(parsed.gtinOriginal, "7701234567897");
  assert.equal(parsed.lot, undefined);
  assert.equal(parsed.expiry, undefined);
  assert.equal(parsed.format, "ean_13");
  assert.deepEqual(parsed.warnings, []);
});

test("rejects an invalid GTIN check digit but keeps the scanned value", () => {
  const parsed = parseBarcode("09520123456780");
  assert.equal(parsed.kind, "GTIN");
  assert.equal(parsed.gtin, undefined);
  assert.equal(parsed.gtinOriginal, "09520123456780");
  assert.match(parsed.warnings[0], /dígito verificador/);
});

test("parses GS1-128 with GTIN, expiry and lot", () => {
  const parsed = parseBarcode("01095201234567881718042610ABC1", "code_128");
  assert.equal(parsed.kind, "GS1");
  assert.equal(parsed.gtin, GTIN);
  assert.equal(parsed.expiry, "2018-04-26");
  assert.equal(parsed.lot, "ABC1");
  assert.equal(parsed.format, "code_128");
});

test("parses GS1 with FNC1 separators", () => {
  const parsed = parseBarcode("0109520123456788\u001d17261231");
  assert.equal(parsed.kind, "GS1");
  assert.equal(parsed.expiry, "2026-12-31");
});

test("parses GS1 with AIM prefix and human readable format", () => {
  const withPrefix = parseBarcode("]C1010952012345678817261231");
  assert.equal(withPrefix.kind, "GS1");
  assert.equal(withPrefix.expiry, "2026-12-31");

  const readable = parseBarcode(
    "(01)09520123456788(17)261231(10)LOT-1",
    "code_128",
  );
  assert.equal(readable.kind, "GS1");
  assert.equal(readable.expiry, "2026-12-31");
  assert.equal(readable.lot, "LOT-1");
});

test("parses GS1 production date, serial, weight and price", () => {
  const parsed = parseBarcode(
    "01095201234567881126010121123456|310300019539220299",
  );
  assert.equal(parsed.productionDate, "2026-01-01");
  assert.equal(parsed.serial, "123456");
  assert.equal(parsed.netWeightKg, 0.195);
  assert.equal(parsed.price, 2.99);
});

test("handles GS1 dates including the last day of the month and leap years", () => {
  assert.equal(parseGs1Date("261231"), "2026-12-31");
  assert.equal(parseGs1Date("270200"), "2027-02-28");
  assert.equal(parseGs1Date("280200"), "2028-02-29");
  assert.equal(parseGs1Date("261332"), null);
  assert.equal(parseGs1Date("260230"), null);
  assert.equal(parseGs1Date("26"), null);
});

test("parses implicit decimals for GS1 measures", () => {
  assert.equal(parseGs1Decimal("3103", "000195"), 0.195);
  assert.equal(parseGs1Decimal("3922", "0299"), 2.99);
  assert.equal(parseGs1Decimal("3103", "abc"), null);
});

test("parses a GS1 Digital Link without fetching it", () => {
  const data = parseDigitalLink(
    "https://id.gs1.org/01/09520123456788/10/ABC1?17=261231",
  );
  assert.deepEqual(data, {
    "01": GTIN,
    "10": "ABC1",
    "17": "261231",
  });

  const parsed = parseBarcode(
    "https://id.gs1.org/01/09520123456788/10/ABC1?17=261231",
    "qr_code",
  );
  assert.equal(parsed.kind, "DIGITAL_LINK");
  assert.equal(parsed.gtin, GTIN);
  assert.equal(parsed.lot, "ABC1");
  assert.equal(parsed.expiry, "2026-12-31");
  assert.equal(parsed.format, "qr_code");
});

test("rejects insecure or non-GS1 links", () => {
  const insecure = parseBarcode(
    "http://id.gs1.org/01/09520123456788?17=261231",
  );
  assert.equal(insecure.kind, "UNKNOWN");
  assert.match(insecure.warnings[0], /HTTPS/);

  const plain = parseBarcode("https://example.com/producto/123");
  assert.equal(plain.kind, "UNKNOWN");
  assert.match(plain.warnings[0], /datos GS1/);

  const numericPath = parseBarcode("https://example.com/2024/12");
  assert.equal(numericPath.kind, "UNKNOWN");
  assert.match(numericPath.warnings[0], /datos GS1/);
});

test("keeps internal codes untouched and explains they cannot be enriched", () => {
  const parsed = parseBarcode("INT-00123");
  assert.equal(parsed.kind, "INTERNAL");
  assert.equal(parsed.normalized, "INT-00123");
  assert.match(parsed.warnings[0], /Código interno/);
});

test("rejects empty and oversized values", () => {
  assert.equal(parseBarcode("   ").kind, "UNKNOWN");
  const oversized = parseBarcode("A".repeat(3000));
  assert.equal(oversized.kind, "UNKNOWN");
  assert.match(oversized.warnings[0], /tamaño máximo/);
});

test("returns structured GS1 data and surfaces unknown identifiers", () => {
  assert.deepEqual(parseGs1("0109520123456788"), { "01": GTIN });
  assert.deepEqual(parseGs1("0109520123456788|90ABC123"), {
    "01": GTIN,
    "90": "ABC123",
  });
  assert.throws(() => parseGs1("0512345678901234"), /identificador GS1/);
});

test("labels known detector formats", () => {
  assert.equal(barcodeFormatLabel("ean_13"), "EAN-13");
  assert.equal(barcodeFormatLabel("data_matrix"), "DataMatrix");
  assert.equal(barcodeFormatLabel("unknown_format"), "UNKNOWN_FORMAT");
  assert.equal(barcodeFormatLabel("unknown"), "Desconocido");
  assert.equal(barcodeFormatLabel(), "Desconocido");
});
