-- CreateEnum
CREATE TYPE "CreditNoteType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "CreditNoteReason" AS ENUM ('RETURN', 'DISCOUNT', 'CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('ISSUED', 'APPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "note_number" TEXT NOT NULL,
    "type" "CreditNoteType" NOT NULL DEFAULT 'CREDIT',
    "reason" "CreditNoteReason" NOT NULL DEFAULT 'RETURN',
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_items" (
    "id" TEXT NOT NULL,
    "credit_note_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_notes_company_id_created_at_idx" ON "credit_notes"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_notes_company_id_sale_id_idx" ON "credit_notes"("company_id", "sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_company_id_note_number_key" ON "credit_notes"("company_id", "note_number");

-- CreateIndex
CREATE INDEX "credit_note_items_credit_note_id_idx" ON "credit_note_items"("credit_note_id");

-- CreateIndex
CREATE INDEX "credit_note_items_product_id_idx" ON "credit_note_items"("product_id");

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_note_items" ENABLE ROW LEVEL SECURITY;
