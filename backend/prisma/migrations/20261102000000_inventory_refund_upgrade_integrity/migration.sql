ALTER TABLE "distributors" ADD COLUMN "stock_reconciled" BOOLEAN NOT NULL DEFAULT true;
UPDATE "distributors" AS distributor SET "stock_reconciled" = false
WHERE EXISTS (SELECT 1 FROM "distributor_balances" balance WHERE balance."distributor_id" = distributor."id" AND balance."balance_quantity" > 0);
CREATE TABLE "distributor_stocks" (
  "distributor_id" TEXT NOT NULL, "product_id" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  CONSTRAINT "distributor_stocks_pkey" PRIMARY KEY ("distributor_id", "product_id"),
  CONSTRAINT "distributor_stocks_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "distributor_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "distributor_stocks_quantity_nonnegative" CHECK ("quantity" >= 0)
);
CREATE INDEX "distributor_stocks_product_id_idx" ON "distributor_stocks"("product_id");
ALTER TABLE "sale_items" ADD COLUMN "unit_cost_snapshot" DECIMAL(14,4);
ALTER TABLE "plan_upgrade_requests" ADD COLUMN "billing_cycle" "BillingCycle";
ALTER TABLE "credit_notes" ADD COLUMN "operation_key" TEXT;
CREATE UNIQUE INDEX "credit_notes_operation_key_key" ON "credit_notes"("operation_key");
