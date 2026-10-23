-- CreateEnum
CREATE TYPE "PlatformAccountType" AS ENUM ('CASH', 'BANK', 'DIGITAL_WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "PlatformTransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- AlterTable
ALTER TABLE "api_usage" ADD COLUMN "tokens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlatformAccountType" NOT NULL DEFAULT 'CASH',
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "initial_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" "PlatformTransactionType" NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT,
    "subscription_id" TEXT,
    "payment_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'tokens',
    "cost_per_unit" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_transactions_account_id_occurred_at_idx" ON "platform_transactions"("account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_transactions_type_occurred_at_idx" ON "platform_transactions"("type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_providers_slug_key" ON "api_providers"("slug");

-- CreateIndex
CREATE INDEX "api_usage_records_company_id_occurred_at_idx" ON "api_usage_records"("company_id", "occurred_at");

-- CreateIndex
CREATE INDEX "api_usage_records_provider_id_occurred_at_idx" ON "api_usage_records"("provider_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "platform_transactions" ADD CONSTRAINT "platform_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "api_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
