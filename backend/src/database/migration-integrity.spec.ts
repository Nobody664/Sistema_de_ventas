import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { FinanceService } from "@/modules/finance/finance.service";

describe("PostgreSQL migration and financial SQL integrity", () => {
  let db: PGlite;
  let finance: FinanceService;
  before(async () => {
    db = new PGlite();
    const directory = resolve(__dirname, "../../prisma/migrations");
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.equal(migrations.at(-1), "20261104000000_invoice_template_defaults");
    for (const migration of migrations.slice(0, -1)) {
      try {
        await db.exec(
          await readFile(
            resolve(directory, migration, "migration.sql"),
            "utf8",
          ),
        );
      } catch (error) {
        throw new Error(`Migration failed: ${migration}`, { cause: error });
      }
    }
    await db.exec(`
      INSERT INTO companies(id,name,slug,updated_at) VALUES ('company-a','Empresa A','company-a',now()),('company-b','Empresa B','company-b',now());
      INSERT INTO invoice_templates(id,name,content,is_global,is_default,company_id,updated_at) VALUES
        ('global-old','Global anterior','legacy',true,true,NULL,'2026-01-01'),
        ('global-new','Global reciente','legacy',true,true,NULL,'2026-02-01'),
        ('tenant-old','Empresa anterior','legacy',false,true,'company-a','2026-01-01'),
        ('tenant-new','Empresa reciente','legacy',false,true,'company-a','2026-02-01');
    `);
    await db.exec(
      await readFile(
        resolve(directory, migrations.at(-1)!, "migration.sql"),
        "utf8",
      ),
    );
    await db.exec(`
      INSERT INTO sales(id,company_id,sale_number,status,subtotal,tax_amount,total_amount,paid_amount,change_amount,created_at,updated_at)
      SELECT 'sale-' || lpad(n::text,4,'0'),'company-a','SALE-' || n,'COMPLETED',1.25,0,1.25,1.25,0,'2026-10-10','2026-10-10' FROM generate_series(1,1205) n;
      INSERT INTO sales(id,company_id,sale_number,status,subtotal,tax_amount,total_amount,paid_amount,change_amount,created_at,updated_at) VALUES
        ('cancelled','company-a','CANCELLED','CANCELLED',999,0,999,999,0,'2026-10-10','2026-10-10'),
        ('refunded','company-a','REFUNDED','REFUNDED',888,0,888,888,0,'2026-10-10','2026-10-10'),
        ('foreign-sale','company-b','FOREIGN','COMPLETED',9999,0,9999,9999,0,'2026-10-10','2026-10-10');
      INSERT INTO finance_records(id,company_id,direction,category,description,amount,currency,record_date,updated_at) VALUES
        ('usd-a','company-a','ENTRY','PURCHASE','Compra A',10.10,'USD','2026-10-10',now()),
        ('usd-b','company-a','ENTRY','PURCHASE','Compra B',20.20,'USD','2026-10-10',now()),
        ('usd-foreign','company-b','ENTRY','PURCHASE','Compra ajena',9999,'USD','2026-10-10',now());
    `);
    const query = async (sql: Prisma.Sql) =>
      (await db.query(sql.text, sql.values)).rows;
    const prisma = {
      $queryRaw: query,
      $transaction: async <T>(
        work: (tx: { $queryRaw: typeof query }) => Promise<T>,
      ) => {
        await db.exec("BEGIN ISOLATION LEVEL REPEATABLE READ");
        try {
          const result = await work({ $queryRaw: query });
          await db.exec("COMMIT");
          return result;
        } catch (error) {
          await db.exec("ROLLBACK");
          throw error;
        }
      },
    } as unknown as PrismaService;
    finance = new FinanceService(prisma, {} as never);
  });
  after(async () => {
    await db?.close();
  });

  it("applies the full migration history and reconciles duplicate defaults deterministically", async () => {
    const result = await db.query<{ id: string }>(
      "SELECT id FROM invoice_templates WHERE is_default ORDER BY id",
    );
    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["global-new", "tenant-new"],
    );
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_name IN ('outbox_events','distributor_stocks','purchase_receipts')",
    );
    assert.equal(tables.rows.length, 3);
  });
  it("enforces one default per scope and rolls back a reset if a required field is missing", async () => {
    await assert.rejects(
      db.exec(
        "INSERT INTO invoice_templates(id,name,content,is_global,is_default,updated_at) VALUES ('duplicate','Duplicada','structured',true,true,now())",
      ),
      (error: unknown) => (error as { code?: string }).code === "23505",
    );
    await db.exec(
      "BEGIN; UPDATE invoice_templates SET is_default=false WHERE is_global=true;",
    );
    await assert.rejects(
      db.exec(
        "INSERT INTO invoice_templates(id,name,is_global,is_default,updated_at) VALUES ('invalid','Inválida',true,true,now())",
      ),
      (error: unknown) => (error as { code?: string }).code === "23502",
    );
    await db.exec("ROLLBACK");
    const result = await db.query<{ id: string }>(
      "SELECT id FROM invoice_templates WHERE is_global AND is_default",
    );
    assert.equal(result.rows[0].id, "global-new");
  });
  it("executes deep merged pagination without the old 500-row cap", async () => {
    const result = await finance.findAll("company-a", {
      currency: "PEN",
      page: 31,
      limit: 20,
    });
    assert.equal(result.total, 1205);
    assert.equal(result.items.length, 20);
    assert.equal(result.items[0].id, "sale-0601");
    assert.ok(result.items.every((item) => item.source === "SALE"));
  });
  it("aggregates all completed sales while excluding other tenants, cancellations and other currencies", async () => {
    const pen = await finance.getSummary("company-a", {
      currency: "PEN",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    assert.equal(pen.sales.count, 1205);
    assert.equal(pen.sales.total, 1506.25);
    const usd = await finance.getSummary("company-a", {
      currency: "USD",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    assert.equal(usd.entries.count, 2);
    assert.equal(usd.entries.total, 30.3);
    assert.equal(usd.sales.total, 0);
  });
  it("binds hostile search text as data and preserves the schema", async () => {
    const result = await finance.findAll("company-a", {
      search: "'; DROP TABLE sales; --",
      page: 1,
      limit: 20,
    });
    assert.equal(result.total, 0);
    const count = await db.query<{ count: string }>(
      "SELECT count(*) FROM sales",
    );
    assert.equal(Number(count.rows[0].count), 1208);
  });
});
