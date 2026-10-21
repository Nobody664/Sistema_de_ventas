import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { CustomersService } from "./customers.service";

function makeService(prisma: any) {
  return new CustomersService(prisma, {} as any, {} as any);
}

describe("CustomersService.exportCustomers", () => {
  it("returns a CSV export with purchase stats per customer", async () => {
    const prisma: any = {
      customer: {
        findMany: async () => [
          {
            id: "c1",
            firstName: "Ana",
            lastName: "Perez",
            documentValue: "12345678",
            email: "ana@test.com",
            phone: "999888777",
            createdAt: new Date(),
          },
          {
            id: "c2",
            firstName: "Luis",
            lastName: null,
            documentValue: null,
            email: null,
            phone: null,
            createdAt: new Date(),
          },
        ],
      },
      sale: {
        groupBy: async () => [
          {
            customerId: "c1",
            _count: { _all: 3 },
            _sum: { totalAmount: 150 },
          },
        ],
      },
    };

    const svc = makeService(prisma);
    const result = await svc.exportCustomers("company1", "csv");

    assert.strictEqual(result.contentType, "text/csv");
    assert.ok(result.filename.startsWith("clientes_"));
    const decoded = Buffer.from(result.data, "base64").toString("utf-8");
    assert.ok(decoded.includes("Nombres"));
    assert.ok(decoded.includes("Ana"));
    assert.ok(decoded.includes("150"));
    assert.ok(decoded.includes("0")); // customer with no sales
  });

  it("returns a PDF export when format is pdf", async () => {
    const prisma: any = {
      customer: { findMany: async () => [] },
      sale: { groupBy: async () => [] },
    };

    const svc = makeService(prisma);
    const result = await svc.exportCustomers("company1", "pdf");

    assert.strictEqual(result.contentType, "application/pdf");
    const decoded = Buffer.from(result.data, "base64");
    assert.strictEqual(decoded.subarray(0, 5).toString(), "%PDF-");
  });
});
