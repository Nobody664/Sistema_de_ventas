-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('UNIT', 'KG', 'LT', 'MT');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "base_unit" "UnitOfMeasure" NOT NULL DEFAULT 'UNIT',
ALTER COLUMN "sale_price" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "cost_price" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "stock_quantity" SET DEFAULT 0,
ALTER COLUMN "stock_quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "min_stock" SET DEFAULT 5,
ALTER COLUMN "min_stock" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "reorder_point" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "safety_stock" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "presentation_id" TEXT,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "product_batches" ALTER COLUMN "quantity_received" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "quantity_available" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "purchase_price" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "inventory_kardex" ALTER COLUMN "qty_in" SET DEFAULT 0,
ALTER COLUMN "qty_in" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "unit_cost_in" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "total_cost_in" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "qty_out" SET DEFAULT 0,
ALTER COLUMN "qty_out" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "unit_cost_out" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "total_cost_out" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "balance_qty" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "balance_unit_cost" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "balance_total_cost" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "presentation_id" TEXT,
ADD COLUMN     "total_cost" DECIMAL(12,4),
ADD COLUMN     "unit_cost" DECIMAL(12,4),
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "distributor_balances" ALTER COLUMN "starting_quantity" SET DEFAULT 0,
ALTER COLUMN "starting_quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "returned_quantity" SET DEFAULT 0,
ALTER COLUMN "returned_quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "sold_quantity" SET DEFAULT 0,
ALTER COLUMN "sold_quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "balance_quantity" SET DEFAULT 0,
ALTER COLUMN "balance_quantity" SET DATA TYPE DECIMAL(14,3);

-- CreateTable
CREATE TABLE "product_presentations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "factor" DECIMAL(14,3) NOT NULL,
    "price" DECIMAL(12,4),
    "barcode" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entry_items" (
    "id" TEXT NOT NULL,
    "stock_entry_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "presentation_id" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "base_quantity" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_entry_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_presentations_company_id_product_id_idx" ON "product_presentations"("company_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_presentations_product_id_name_key" ON "product_presentations"("product_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_presentations_company_id_barcode_key" ON "product_presentations"("company_id", "barcode");

-- CreateIndex
CREATE INDEX "stock_entries_company_id_created_at_idx" ON "stock_entries"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_entries_branch_id_idx" ON "stock_entries"("branch_id");

-- CreateIndex
CREATE INDEX "stock_entry_items_stock_entry_id_idx" ON "stock_entry_items"("stock_entry_id");

-- CreateIndex
CREATE INDEX "stock_entry_items_product_id_idx" ON "stock_entry_items"("product_id");

-- CreateIndex
CREATE INDEX "sale_items_presentation_id_idx" ON "sale_items"("presentation_id");

-- CreateIndex
CREATE INDEX "inventory_movements_presentation_id_idx" ON "inventory_movements"("presentation_id");

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "product_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_stock_entry_id_fkey" FOREIGN KEY ("stock_entry_id") REFERENCES "stock_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "product_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "product_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
