import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCsvExport,
  buildPdfExport,
  buildXlsxExport,
  ExportColumn,
} from "./export.helper";

interface Row {
  name: string;
  price: number;
  note: string;
}

const columns: ExportColumn<Row>[] = [
  { header: "Nombre", value: (row) => row.name },
  {
    header: "Precio",
    value: (row) => row.price,
    pdfValue: (row) => `S/ ${row.price.toFixed(2)}`,
  },
  { header: "Nota", value: (row) => row.note },
];

const rows: Row[] = [
  { name: "Gaseosa 500ml", price: 2.5, note: "fria" },
  { name: 'Cafe "especial", 1kg', price: 18, note: "linea 1\nlinea 2" },
];

const decode = (base64: string): Buffer => Buffer.from(base64, "base64");

describe("csv export", () => {
  it("returns a utf-8 BOM, proper filename and escaped cells", () => {
    const result = buildCsvExport("productos", columns, rows);

    assert.match(result.filename, /^productos_\d{4}-\d{2}-\d{2}\.csv$/);
    assert.equal(result.contentType, "text/csv");

    const text = decode(result.data).toString("utf-8");
    assert.ok(text.startsWith("\uFEFFNombre,Precio,Nota"));
    assert.ok(text.includes('"Cafe ""especial"", 1kg"'));
    assert.ok(text.includes('"linea 1\nlinea 2"'));
    assert.ok(text.includes("\r\n"));
  });

  it("does not quote plain cells", () => {
    const text = decode(
      buildCsvExport("productos", columns, [rows[0]]).data,
    ).toString("utf-8");

    assert.ok(text.includes("Gaseosa 500ml,2.5,fria"));
  });
});

describe("xlsx export", () => {
  it("produces a real xlsx (zip) payload with the right mime type", async () => {
    const result = await buildXlsxExport(
      "productos",
      "Productos",
      columns,
      rows,
    );
    const buffer = decode(result.data);

    assert.match(result.filename, /^productos_\d{4}-\d{2}-\d{2}\.xlsx$/);
    assert.equal(
      result.contentType,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK");
    assert.ok(buffer.length > 1000);
  });
});

describe("pdf export", () => {
  it("produces a real pdf payload with the right mime type", async () => {
    const result = await buildPdfExport(
      "ventas",
      "Reporte de Ventas",
      columns,
      rows,
      "Total: S/ 20.50",
    );
    const buffer = decode(result.data);

    assert.match(result.filename, /^ventas_\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(result.contentType, "application/pdf");
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(buffer.length > 500);
  });

  it("handles an empty dataset", async () => {
    const result = await buildPdfExport(
      "ventas",
      "Reporte de Ventas",
      columns,
      [],
    );
    assert.equal(
      decode(result.data).subarray(0, 5).toString("latin1"),
      "%PDF-",
    );
  });

  it("paginates large datasets", async () => {
    const many = Array.from({ length: 200 }, (_, index) => ({
      name: `Producto ${index}`,
      price: index,
      note: "ok",
    }));
    const result = await buildPdfExport(
      "productos",
      "Productos",
      columns,
      many,
    );
    const text = decode(result.data).toString("latin1");

    assert.ok(text.includes("/Count"));
    assert.ok((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length > 1);
  });
});
