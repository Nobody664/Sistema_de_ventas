import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { storeAmounts } from "./store-pricing";
import { StoreCartItemDto } from "./dto/store-commerce.dto";

test("calcula impuestos incluidos/excluidos y envío sin duplicar el total", () => {
  const lines = [
    { quantity: new Prisma.Decimal(2), price: new Prisma.Decimal("11.8") },
  ];
  const included = storeAmounts(
    lines,
    new Prisma.Decimal("5.9"),
    new Prisma.Decimal(18),
    true,
  );
  assert.equal(included.subtotal, "20.00");
  assert.equal(included.shippingAmount, "5.00");
  assert.equal(included.taxAmount, "4.50");
  assert.equal(included.totalAmount, "29.50");
  const excluded = storeAmounts(
    [{ quantity: new Prisma.Decimal(2), price: new Prisma.Decimal(10) }],
    new Prisma.Decimal(5),
    new Prisma.Decimal(18),
    false,
  );
  assert.equal(excluded.totalAmount, included.totalAmount);
});

test("el DTO de carrito rechaza precios elegidos por el navegador y cantidades inválidas", async () => {
  for (const data of [
    { version: 1, productId: "p", quantity: -1 },
    { version: 1, productId: "p", quantity: 1, unitPrice: 0 },
    { version: 1, productId: "p", quantity: 0.0001 },
  ]) {
    const errors = await validate(plainToInstance(StoreCartItemDto, data), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    assert.ok(errors.length > 0);
  }
});

test("PostgreSQL aplica las migraciones, aísla cuentas y protege reservas frente a salidas de cualquier canal", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE companies(id TEXT PRIMARY KEY); CREATE TABLE users(id TEXT PRIMARY KEY);
      CREATE TABLE customers(id TEXT PRIMARY KEY, company_id TEXT NOT NULL);
      CREATE TABLE products(id TEXT PRIMARY KEY, company_id TEXT NOT NULL, stock_quantity NUMERIC(14,3) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true);
      CREATE TABLE product_batches(id TEXT PRIMARY KEY, company_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity_available NUMERIC(14,3) NOT NULL);`);
    for (const migration of [
      "20261111000000_store_accounts_catalog",
      "20261112000000_store_cart_reservations",
    ])
      await db.exec(
        readFileSync(
          resolve("prisma/migrations", migration, "migration.sql"),
          "utf8",
        ),
      );
    await db.exec(`INSERT INTO companies VALUES ('a'),('b'); INSERT INTO users VALUES ('u'); INSERT INTO customers VALUES ('ca','a');
      INSERT INTO customer_accounts(id,company_id,user_id,customer_id) VALUES ('account','a','u','ca');
      INSERT INTO products(id,company_id,stock_quantity) VALUES ('p','a',5);
      INSERT INTO product_batches(id,company_id,product_id,quantity_available) VALUES ('batch','a','p',5);`);
    await assert.rejects(
      db.exec(
        `INSERT INTO customer_accounts(id,company_id,user_id,customer_id) VALUES ('foreign','b','u','ca')`,
      ),
    );
    const claims = await Promise.all([
      db.query(
        `UPDATE products SET reserved_quantity=reserved_quantity+4 WHERE id='p' AND stock_quantity-reserved_quantity>=4 RETURNING id`,
      ),
      db.query(
        `UPDATE products SET reserved_quantity=reserved_quantity+4 WHERE id='p' AND stock_quantity-reserved_quantity>=4 RETURNING id`,
      ),
    ]);
    assert.equal(
      claims.reduce((sum, claim) => sum + claim.rows.length, 0),
      1,
    );
    await assert.rejects(
      db.exec(
        `UPDATE products SET stock_quantity=stock_quantity-2 WHERE id='p'`,
      ),
    );
    await db.exec(
      `UPDATE products SET stock_quantity=stock_quantity-1 WHERE id='p'; UPDATE product_batches SET reserved_quantity=4 WHERE id='batch'`,
    );
    await assert.rejects(
      db.exec(
        `UPDATE product_batches SET quantity_available=2 WHERE id='batch'`,
      ),
    );
    await db.exec(
      `UPDATE products SET reserved_quantity=0 WHERE id='p'; UPDATE products SET stock_quantity=0 WHERE id='p'`,
    );
    assert.equal(
      (
        await db.query<{ stock_quantity: string }>(
          `SELECT stock_quantity FROM products WHERE id='p'`,
        )
      ).rows[0].stock_quantity,
      "0.000",
    );
  } finally {
    await db.close();
  }
});
