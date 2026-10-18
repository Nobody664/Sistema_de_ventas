-- AlterTable: assign a distributor (supplier) to stock entries (purchases)
ALTER TABLE "stock_entries" ADD COLUMN "distributor_id" TEXT;

-- CreateIndex
CREATE INDEX "stock_entries_distributor_id_idx" ON "stock_entries"("distributor_id");

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
