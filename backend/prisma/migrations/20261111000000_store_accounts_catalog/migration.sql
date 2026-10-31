CREATE TYPE "StoreAccountStatus" AS ENUM ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','CLOSED');
CREATE TABLE "storefront_settings" (
 "company_id" TEXT PRIMARY KEY REFERENCES "companies"("id") ON DELETE CASCADE,
 "enabled" BOOLEAN NOT NULL DEFAULT false, "registration_enabled" BOOLEAN NOT NULL DEFAULT true,
 "title" TEXT, "description" TEXT, "version" INTEGER NOT NULL DEFAULT 1, "updated_at" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_id_key" UNIQUE ("company_id","id");
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_id_key" UNIQUE ("company_id","id");
ALTER TABLE "products" ADD COLUMN "store_visible" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "store_sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "customer_accounts" (
 "id" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
 "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "customer_id" TEXT NOT NULL UNIQUE, "status" "StoreAccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
 "verified_at" TIMESTAMP(3), "terms_version" TEXT NOT NULL DEFAULT '2026-01', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("company_id","user_id"), UNIQUE ("company_id","id"), UNIQUE ("company_id","customer_id"),
 FOREIGN KEY ("company_id","customer_id") REFERENCES "customers"("company_id","id") ON DELETE RESTRICT
);
CREATE TABLE "store_sessions" (
 "id" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL, "account_id" TEXT NOT NULL, "auth_version" INTEGER NOT NULL,
 "expires_at" TIMESTAMP(3) NOT NULL, "revoked_at" TIMESTAMP(3),
 FOREIGN KEY ("company_id","account_id") REFERENCES "customer_accounts"("company_id","id") ON DELETE CASCADE
);
CREATE INDEX "store_sessions_account_id_expires_at_idx" ON "store_sessions"("account_id","expires_at");
CREATE TABLE "store_refresh_tokens" (
 "hash" TEXT PRIMARY KEY, "session_id" TEXT NOT NULL REFERENCES "store_sessions"("id") ON DELETE CASCADE, "used_at" TIMESTAMP(3)
);
CREATE INDEX "store_refresh_tokens_session_id_idx" ON "store_refresh_tokens"("session_id");
CREATE TABLE "store_account_actions" (
 "hash" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL, "account_id" TEXT NOT NULL, "purpose" TEXT NOT NULL,
 "expires_at" TIMESTAMP(3) NOT NULL, "used_at" TIMESTAMP(3),
 FOREIGN KEY ("company_id","account_id") REFERENCES "customer_accounts"("company_id","id") ON DELETE CASCADE
);
CREATE INDEX "store_account_actions_account_id_purpose_idx" ON "store_account_actions"("account_id","purpose");
CREATE TABLE "customer_addresses" (
 "id" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL, "account_id" TEXT NOT NULL, "label" TEXT NOT NULL, "recipient" TEXT NOT NULL,
 "phone" TEXT NOT NULL, "street" TEXT NOT NULL, "district" TEXT NOT NULL, "reference" TEXT, "is_default" BOOLEAN NOT NULL DEFAULT false,
 UNIQUE ("company_id","id"),
 FOREIGN KEY ("company_id","account_id") REFERENCES "customer_accounts"("company_id","id") ON DELETE CASCADE
);
CREATE INDEX "customer_addresses_account_id_idx" ON "customer_addresses"("account_id");
CREATE UNIQUE INDEX "customer_addresses_one_default" ON "customer_addresses"("account_id") WHERE "is_default";
CREATE TABLE "store_mail" (
 "id" TEXT PRIMARY KEY, "encrypted_body" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
 "lease_until" TIMESTAMP(3), "delivered_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "store_mail_delivered_at_lease_until_idx" ON "store_mail"("delivered_at","lease_until");
CREATE INDEX "products_store_catalog_idx" ON "products"("company_id","store_visible","is_active","store_sort_order","id");
