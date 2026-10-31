import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { ProductsService } from "./products.service";

function fixture() {
  const writes: Prisma.ProductCreateArgs[] = [];
  const service = new ProductsService(
    {
      product: {
        create: async (args: Prisma.ProductCreateArgs) => {
          writes.push(args);
          return {
            ...args.data,
            id: "product",
            stockQuantity: new Prisma.Decimal(
              args.data.stockQuantity as number,
            ),
            minStock: new Prisma.Decimal(0),
            salePrice: new Prisma.Decimal(2),
            costPrice: new Prisma.Decimal(1),
          };
        },
      },
    } as never,
    { validateLimit: async () => undefined } as never,
    {
      notifyIfLowStock: async () => undefined,
      notifyIfExpiring: async () => undefined,
    } as never,
    { log: async () => undefined } as never,
  );
  return { service, writes };
}

test("crea producto y lote inicial en una sola escritura anidada con el perfil seleccionado", async () => {
  const { service, writes } = fixture();
  await service.createProduct("company-a", {
    name: "Conserva",
    sku: "SKU",
    salePrice: 2,
    costPrice: 1,
    stockQuantity: 5,
    initialBatchNumber: " GS1-LOT ",
    expiryDate: "2027-12-31",
    expiryProfile: "LONG_LIFE",
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.expiryProfile, "LONG_LIFE");
  assert.deepEqual(writes[0].data.batches, {
    create: {
      companyId: "company-a",
      batchNumber: "GS1-LOT",
      quantityReceived: 5,
      quantityAvailable: 5,
      purchasePrice: 1,
      expirationDate: new Date("2027-12-31"),
    },
  });
  assert.equal(writes[0].data.stockQuantity, 5);
});

test("sin stock no crea lote fantasma y rechaza lote explícito sin existencias", async () => {
  const { service, writes } = fixture();
  await service.createProduct("company-a", {
    name: "Conserva",
    salePrice: 2,
    costPrice: 1,
    stockQuantity: 0,
    expiryDate: "2027-12-31",
  });
  assert.equal(writes[0].data.batches, undefined);
  await assert.rejects(
    service.createProduct("company-a", {
      name: "Conserva",
      salePrice: 2,
      costPrice: 1,
      stockQuantity: 0,
      initialBatchNumber: "LOT",
    }),
    /stock inicial/,
  );
  assert.equal(writes.length, 1);
});
