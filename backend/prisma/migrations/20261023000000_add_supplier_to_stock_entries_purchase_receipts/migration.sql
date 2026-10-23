-- AlterTable
ALTER TABLE "purchase_receipts" ADD COLUMN     "supplier_id" TEXT;

-- AlterTable
ALTER TABLE "stock_entries" ADD COLUMN     "supplier_id" TEXT;

-- CreateIndex
CREATE INDEX "purchase_receipts_supplier_id_idx" ON "purchase_receipts"("supplier_id");

-- CreateIndex
CREATE INDEX "stock_entries_supplier_id_idx" ON "stock_entries"("supplier_id");

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
