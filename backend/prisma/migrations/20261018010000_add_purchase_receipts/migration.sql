-- AlterTable: link stock entries to an internal purchase receipt (boleta interna)
ALTER TABLE "stock_entries" ADD COLUMN "receipt_id" TEXT;

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "distributor_id" TEXT,
    "series" TEXT NOT NULL DEFAULT 'BI',
    "number" INTEGER NOT NULL,
    "full_number" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "entry_count" INTEGER NOT NULL,
    "item_count" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_company_id_series_number_key" ON "purchase_receipts"("company_id", "series", "number");

-- CreateIndex
CREATE INDEX "purchase_receipts_company_id_issued_at_idx" ON "purchase_receipts"("company_id", "issued_at");

-- CreateIndex
CREATE INDEX "purchase_receipts_distributor_id_idx" ON "purchase_receipts"("distributor_id");

-- CreateIndex
CREATE INDEX "stock_entries_receipt_id_idx" ON "stock_entries"("receipt_id");

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (deny-by-default for anon/authenticated; app uses postgres role which bypasses RLS)
ALTER TABLE "purchase_receipts" ENABLE ROW LEVEL SECURITY;
