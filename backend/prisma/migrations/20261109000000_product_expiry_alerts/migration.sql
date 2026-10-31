ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PRODUCT_EXPIRED';
CREATE TYPE "ProductExpiryProfile" AS ENUM ('PERISHABLE', 'STANDARD', 'LONG_LIFE', 'CUSTOM');
ALTER TABLE "products" ADD COLUMN "expiry_profile" "ProductExpiryProfile" NOT NULL DEFAULT 'STANDARD', ADD COLUMN "expiry_warning_days" INTEGER;
CREATE INDEX "products_expiry_profile_expiry_date_idx" ON "products"("expiry_profile", "expiry_date");
ALTER TABLE "products" ADD CONSTRAINT "products_expiry_warning_policy_check" CHECK (
  ("expiry_profile"='CUSTOM' AND "expiry_warning_days" BETWEEN 1 AND 3650 AND "expiry_warning_days" IS NOT NULL)
  OR ("expiry_profile"<>'CUSTOM' AND "expiry_warning_days" IS NULL)
);
CREATE TABLE "product_expiry_alerts" (
  "id" TEXT PRIMARY KEY, "event_key" TEXT NOT NULL, "company_id" TEXT NOT NULL, "product_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL, "batch_id" TEXT, "expiry_date_key" TEXT NOT NULL,
  "stage" TEXT NOT NULL, "reminder_key" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_expiry_alerts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_expiry_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_expiry_alerts_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_expiry_alerts_event_key_key" ON "product_expiry_alerts"("event_key");
CREATE INDEX "product_expiry_alerts_company_id_product_id_created_at_idx" ON "product_expiry_alerts"("company_id", "product_id", "created_at");
