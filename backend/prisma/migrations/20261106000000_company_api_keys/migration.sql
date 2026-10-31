CREATE TABLE "company_api_keys" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_api_keys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_api_keys_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "company_api_keys_key_hash_key" ON "company_api_keys"("key_hash");
CREATE INDEX "company_api_keys_company_id_created_at_idx" ON "company_api_keys"("company_id", "created_at");
