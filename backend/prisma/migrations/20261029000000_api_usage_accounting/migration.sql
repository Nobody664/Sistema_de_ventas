ALTER TABLE "api_usage_records"
  ADD COLUMN "billed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "transaction_id" TEXT;

UPDATE "api_usage_records" AS usage
SET "currency" = provider."currency"
FROM "api_providers" AS provider
WHERE usage."provider_id" = provider."id";

ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "platform_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
