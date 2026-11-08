import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ProductsService } from "./products.service";

test("la baja global por producto exige seleccionar un lote y no modifica stock ni finanzas", async () => {
  let writes = 0;
  const service = new ProductsService(
    {
      product: {
        findFirst: async () => ({ id: "p", stockQuantity: 10, isActive: true }),
      },
      $transaction: async () => {
        writes++;
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  await assert.rejects(
    service.writeOffExpiredStock("company-a", "p", "owner"),
    ConflictException,
  );
  assert.equal(writes, 0);
});

test("el endpoint legado no permite consultar productos de otra compañía", async () => {
  const service = new ProductsService(
    { product: { findFirst: async () => null } } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  await assert.rejects(
    service.writeOffExpiredStock("company-b", "foreign", "owner"),
    NotFoundException,
  );
});
