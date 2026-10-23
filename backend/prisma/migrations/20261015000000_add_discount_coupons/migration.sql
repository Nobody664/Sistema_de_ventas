-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "discount_coupons" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DECIMAL(12,2) NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "min_purchase" DECIMAL(12,2),
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_coupons_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "coupon_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "discount_coupons_company_id_code_key" ON "discount_coupons"("company_id", "code");

-- CreateIndex
CREATE INDEX "discount_coupons_company_id_is_active_idx" ON "discount_coupons"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "sales_coupon_id_idx" ON "sales"("coupon_id");

-- AddForeignKey
ALTER TABLE "discount_coupons" ADD CONSTRAINT "discount_coupons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "discount_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
