import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface ExportColumn<T> {
  header: string;
  width?: number;
  value: (row: T) => string | number;
  pdfValue?: (row: T) => string;
}

export interface ExportResult {
  filename: string;
  contentType: string;
  data: string;
}

function datedFilename(baseName: string, extension: string): string {
  return `${baseName}_${new Date().toISOString().split("T")[0]}.${extension}`;
}

function encode(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString("base64");
}

function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const text =
    typeof value === "string" &&
    (/^[\s\u0000-\u001f\u007f\ufeff]*[=+\-@]/u.test(raw) ||
      /^[\t\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(raw))
      ? `'${raw}`
      : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cellOf<T>(column: ExportColumn<T>, row: T): string | number {
  return column.value(row);
}

export function buildCsvExport<T>(
  baseName: string,
  columns: ExportColumn<T>[],
  rows: T[],
): ExportResult {
  const lines = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => cellOf(column, row))),
  ]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n");

  const content = Buffer.from(`\uFEFF${lines}`, "utf-8");

  return {
    filename: datedFilename(baseName, "csv"),
    contentType: "text/csv",
    data: encode(content),
  };
}

export async function buildXlsxExport<T>(
  baseName: string,
  sheetTitle: string,
  columns: ExportColumn<T>[],
  rows: T[],
): Promise<ExportResult> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Huanka-Saas";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetTitle.slice(0, 31));
  worksheet.columns = columns.map((column, index) => ({
    header: column.header,
    key: `c${index}`,
    width: column.width ?? 20,
  }));

  for (const row of rows) {
    worksheet.addRow(columns.map((column) => cellOf(column, row)));
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E7D32" },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: false };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    filename: datedFilename(baseName, "xlsx"),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: encode(Buffer.from(buffer as ArrayBuffer)),
  };
}

export async function buildPdfExport<T>(
  baseName: string,
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
  summary?: string,
): Promise<ExportResult> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks))),
  );

  const margin = doc.page.margins.left;
  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce(
    (sum, column) => sum + (column.width ?? 1),
    0,
  );
  const widths = columns.map(
    (column) => (pageWidth * (column.width ?? 1)) / totalWeight,
  );
  const rowHeight = 18;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - rowHeight;

  let y = 0;

  const drawHeaderRow = () => {
    doc.save();
    doc.rect(margin, y, pageWidth, rowHeight).fill("#2E7D32");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF");
    let x = margin;
    columns.forEach((column, index) => {
      doc.text(column.header, x + 4, y + 5, {
        width: widths[index] - 8,
        ellipsis: true,
        lineBreak: false,
      });
      x += widths[index];
    });
    doc.restore();
    y += rowHeight;
  };

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#111111")
    .text(title, margin, margin);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555555")
    .text(
      `Generado: ${new Date().toISOString().split("T")[0]}`,
      margin,
      doc.y + 4,
    );
  if (summary) {
    doc.text(summary, margin, doc.y + 2);
  }
  y = doc.y + 12;

  drawHeaderRow();

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeaderRow();
    }

    if (rowIndex % 2 === 1) {
      doc.save();
      doc.rect(margin, y, pageWidth, rowHeight).fill("#F2F2F2");
      doc.restore();
    }

    doc.font("Helvetica").fontSize(9).fillColor("#222222");
    let x = margin;
    columns.forEach((column, index) => {
      const text = column.pdfValue
        ? column.pdfValue(row)
        : String(column.value(row) ?? "");
      doc.text(text, x + 4, y + 5, {
        width: widths[index] - 8,
        ellipsis: true,
        lineBreak: false,
      });
      x += widths[index];
    });

    y += rowHeight;
  });

  doc.end();
  const buffer = await finished;

  return {
    filename: datedFilename(baseName, "pdf"),
    contentType: "application/pdf",
    data: encode(buffer),
  };
}
