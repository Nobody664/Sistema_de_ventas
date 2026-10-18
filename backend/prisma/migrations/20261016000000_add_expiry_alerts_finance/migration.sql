-- AlterEnum: add PRODUCT_EXPIRING_SOON to NotificationType
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_EXPIRING_SOON';

-- CreateEnum
CREATE TYPE "FinanceDirection" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "FinanceCategory" AS ENUM ('PURCHASE', 'SALE', 'PAYROLL', 'ELECTRICITY', 'WATER', 'MAINTENANCE', 'OTHER');

-- AlterTable: products expiry date
ALTER TABLE "products" ADD COLUMN "expiry_date" TIMESTAMP(3);

-- AlterTable: stock_entries entry date
ALTER TABLE "stock_entries" ADD COLUMN "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: stock_entry_items expiry date (per item / batch)
ALTER TABLE "stock_entry_items" ADD COLUMN "expiry_date" TIMESTAMP(3);

-- AlterTable: employees salary + payment day
ALTER TABLE "employees" ADD COLUMN "salary" DECIMAL(12,2);
ALTER TABLE "employees" ADD COLUMN "payment_day" INTEGER;

-- CreateTable
CREATE TABLE "finance_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "direction" "FinanceDirection" NOT NULL,
    "category" "FinanceCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "record_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "reference" TEXT,
    "supplier" TEXT,
    "employee_id" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_records_company_id_record_date_idx" ON "finance_records"("company_id", "record_date");

-- CreateIndex
CREATE INDEX "finance_records_company_id_direction_idx" ON "finance_records"("company_id", "direction");

-- CreateIndex
CREATE INDEX "finance_records_company_id_category_idx" ON "finance_records"("company_id", "category");

-- CreateIndex
CREATE INDEX "finance_records_employee_id_idx" ON "finance_records"("employee_id");

-- AddForeignKey
ALTER TABLE "finance_records" ADD CONSTRAINT "finance_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_records" ADD CONSTRAINT "finance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (deny-by-default for anon/authenticated; app uses postgres role which bypasses RLS)
ALTER TABLE "finance_records" ENABLE ROW LEVEL SECURITY;
