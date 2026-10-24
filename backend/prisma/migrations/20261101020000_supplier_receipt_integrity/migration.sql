ALTER TABLE "supplier_orders" ADD COLUMN "stock_entry_id" TEXT, ADD COLUMN "receipt_fingerprint" TEXT;
ALTER TABLE "supplier_order_items" ADD COLUMN "received_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0;

UPDATE "supplier_order_items" AS item
SET "received_quantity" = item."requested_quantity"
FROM "supplier_orders" AS orders
WHERE item."order_id" = orders."id" AND orders."received_at" IS NOT NULL;

CREATE UNIQUE INDEX "supplier_orders_stock_entry_id_key" ON "supplier_orders"("stock_entry_id");
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_stock_entry_id_fkey"
  FOREIGN KEY ("stock_entry_id") REFERENCES "stock_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
