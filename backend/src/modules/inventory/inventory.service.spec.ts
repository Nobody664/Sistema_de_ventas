import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { InventoryService } from "./inventory.service";

function makeService(prisma: any) {
  return new InventoryService(prisma, {} as any, {} as any, {} as any);
}

describe("InventoryService.exportInventory", () => {
  it("returns an XLSX export including stock value", async () => {
    const prisma: any = {
      product: {
        findMany: async () => [
          {
            name: "Producto A",
            sku: "A1",
            baseUnit: "UNIT",
            stockQuantity: 10,
            minStock: 5,
            costPrice: 2,
            category: { name: "Cat" },
          },
          {
            name: "Producto B",
            sku: null,
            baseUnit: "BOX",
            stockQuantity: 1,
            minStock: 5,
            costPrice: 8,
            category: null,
          },
        ],
      },
    };

    const svc = makeService(prisma);
    const result = await svc.exportInventory("company1", "excel");

    assert.strictEqual(
      result.contentType,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    assert.ok(result.filename.startsWith("inventario_"));
    const decoded = Buffer.from(result.data, "base64");
    assert.strictEqual(decoded.subarray(0, 2).toString(), "PK");
  });

  it("returns a PDF export when format is pdf", async () => {
    const prisma: any = { product: { findMany: async () => [] } };
    const svc = makeService(prisma);
    const result = await svc.exportInventory("company1", "pdf");

    assert.strictEqual(result.contentType, "application/pdf");
    const decoded = Buffer.from(result.data, "base64");
    assert.strictEqual(decoded.subarray(0, 5).toString(), "%PDF-");
  });
});
