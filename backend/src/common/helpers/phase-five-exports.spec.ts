import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCsvExport } from "./export.helper";
import { collectExportRows } from "./export-batch.helper";
import { dateRange, pagination } from "./query-bounds.helper";
import { BadRequestException } from "@nestjs/common";

describe("Safe spreadsheet exports and query bounds", () => {
  it("neutralizes formulas including leading whitespace and controls without changing numeric values", () => {
    const values = [
      "=1+1",
      "+SUM(A1)",
      "-1+2",
      "@SUM(A1)",
      " \t=1+1",
      "\r=1+1",
      "\ttext",
      -10,
      1.25,
      "normal",
      'a,"b"',
    ];
    const csv = Buffer.from(
      buildCsvExport(
        "safe",
        [{ header: "=header", value: (value: string | number) => value }],
        values,
      ).data,
      "base64",
    ).toString("utf8");
    assert.ok(csv.startsWith("\ufeff'=header\r\n"));
    for (const value of [
      "'=1+1",
      "'+SUM(A1)",
      "'-1+2",
      "'@SUM(A1)",
      "' \t=1+1",
      "'\ttext",
    ])
      assert.ok(csv.includes(value));
    assert.ok(csv.includes("\r\n-10\r\n1.25\r\nnormal\r\n"));
    assert.ok(csv.includes('"a,""b"""'));
  });
  it("collects exports in stable bounded batches without dropping later rows", async () => {
    const source = Array.from({ length: 1205 }, (_, index) => ({
      id: String(index).padStart(5, "0"),
    }));
    const calls: Array<number> = [];
    const rows = await collectExportRows(async (take, after) => {
      calls.push(take);
      const offset = after
        ? source.findIndex((row) => row.id === after) + 1
        : 0;
      return source.slice(offset, offset + take);
    });
    assert.equal(rows.length, 1205);
    assert.deepEqual(calls, [500, 500, 500]);
    assert.equal(new Set(rows.map((row) => row.id)).size, 1205);
  });
  it("rejects an oversized export instead of silently returning an incomplete file", async () => {
    let id = 0;
    await assert.rejects(
      collectExportRows(async (take) =>
        Array.from({ length: take }, () => ({ id: String(++id) })),
      ),
      BadRequestException,
    );
  });
  it("validates service pagination and bounded real calendar ranges", () => {
    for (const [page, limit] of [
      [0, 20],
      [-1, 20],
      [1, 101],
      [NaN, 20],
      [1.5, 20],
      [1, 0],
    ])
      assert.throws(() => pagination(page, limit), BadRequestException);
    assert.equal(pagination(601, 20).skip, 12000);
    assert.throws(
      () => dateRange("2026-02-31", "2026-03-01"),
      BadRequestException,
    );
    assert.throws(
      () => dateRange("2026-03-02", "2026-03-01"),
      BadRequestException,
    );
    assert.throws(
      () => dateRange("2020-01-01", "2026-01-01"),
      BadRequestException,
    );
    assert.equal(
      dateRange("2026-01-01", "2026-01-02").to?.toISOString(),
      "2026-01-02T23:59:59.999Z",
    );
  });
});
