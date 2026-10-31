CREATE TABLE "barcode_lookup_cache" (
    "id" TEXT NOT NULL,
    "gtin" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "barcode_lookup_cache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "barcode_lookup_cache_gtin_provider_key" ON "barcode_lookup_cache"("gtin", "provider");
CREATE INDEX "barcode_lookup_cache_expires_at_idx" ON "barcode_lookup_cache"("expires_at");
ALTER TABLE "stock_entry_items" ADD COLUMN "batch_number" TEXT, ADD COLUMN "batch_id" TEXT;
CREATE INDEX "stock_entry_items_batch_id_idx" ON "stock_entry_items"("batch_id");
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
