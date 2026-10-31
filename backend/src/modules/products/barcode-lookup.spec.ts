import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProductsService } from "./products.service";

function makeService(options: { product?: unknown; presentation?: unknown }) {
  const calls: { product: unknown[]; presentation: unknown[] } = {
    product: [],
    presentation: [],
  };

  const prisma = {
    product: {
      findFirst: async (args: unknown) => {
        calls.product.push(args);
        return options.product ?? null;
      },
    },
    productPresentation: {
      findFirst: async (args: unknown) => {
        calls.presentation.push(args);
        return options.presentation ?? null;
      },
    },
  };

  return {
    service: new ProductsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    ),
    calls,
  };
}

describe("ProductsService barcode lookup", () => {
  it("searches EAN-13 and GTIN-14 representations in the same tenant", async () => {
    const product = {
      id: "product-1",
      name: "Café",
      barcode: "07701234567897",
    };
    const { service, calls } = makeService({ product });

    const result = await service.findByBarcode("company-a", "7701234567897");

    assert.equal(result, product);
    assert.deepEqual(calls.product[0], {
      where: {
        companyId: "company-a",
        deletedAt: null,
        barcode: { in: ["7701234567897", "07701234567897"] },
      },
      include: { category: true },
    });
    assert.equal(calls.presentation.length, 0);
  });

  it("falls back to an active presentation and returns its product", async () => {
    const product = { id: "product-1", name: "Café", barcode: "7700000000001" };
    const presentation = {
      id: "presentation-1",
      name: "Caja x 12",
      barcode: "7701234567897",
      product,
    };
    const { service, calls } = makeService({ presentation });

    const result = await service.findByBarcode("company-a", "7701234567897");

    assert.deepEqual(result, {
      ...product,
      matchedPresentation: {
        id: "presentation-1",
        name: "Caja x 12",
        barcode: "7701234567897",
      },
    });
    assert.equal(calls.product.length, 1);
    assert.deepEqual(calls.presentation[0], {
      where: {
        companyId: "company-a",
        isActive: true,
        barcode: { in: ["7701234567897", "07701234567897"] },
        product: { companyId: "company-a", deletedAt: null },
      },
      include: { product: { include: { category: true } } },
    });
  });

  it("does not query the database for an empty barcode", async () => {
    const { service, calls } = makeService({});

    assert.equal(await service.findByBarcode("company-a", "   "), null);
    assert.equal(calls.product.length, 0);
    assert.equal(calls.presentation.length, 0);
  });
});
