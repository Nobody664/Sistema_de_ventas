-- Fase 1: plataforma + distribuidores + gate de perfil de empresa
-- Generada con: prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- Additiva (sin drops). Aplica en produccion con: prisma migrate deploy

-- CreateEnum
CREATE TYPE "DistributorType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "DistributorStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SaleChannel" AS ENUM ('POS', 'DISTRIBUTOR', 'ONLINE');

-- AlterEnum
ALTER TYPE "MembershipRole" ADD VALUE 'DISTRIBUTOR';

-- AlterTable
ALTER TABLE "checkout_requests" ADD COLUMN     "address" TEXT,
ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "tax_id" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "profile_complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profile_completed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "distributor_id" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "channel" "SaleChannel" NOT NULL DEFAULT 'POS',
ADD COLUMN     "distributor_id" TEXT;

-- CreateTable
CREATE TABLE "distributors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" TEXT,
    "document_value" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" "DistributorType" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "DistributorStatus" NOT NULL DEFAULT 'ACTIVE',
    "commission_rate" DECIMAL(5,2),
    "price_list_id" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_balances" (
    "id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "starting_quantity" INTEGER NOT NULL DEFAULT 0,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,
    "sold_quantity" INTEGER NOT NULL DEFAULT 0,
    "balance_quantity" INTEGER NOT NULL DEFAULT 0,
    "debt_amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_deliveries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "delivery_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2),
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "items" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "distributors_user_id_key" ON "distributors"("user_id");

-- CreateIndex
CREATE INDEX "distributors_company_id_status_idx" ON "distributors"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "distributors_company_id_code_key" ON "distributors"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_balances_distributor_id_key" ON "distributor_balances"("distributor_id");

-- CreateIndex
CREATE INDEX "distributor_deliveries_company_id_distributor_id_idx" ON "distributor_deliveries"("company_id", "distributor_id");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_deliveries_company_id_delivery_number_key" ON "distributor_deliveries"("company_id", "delivery_number");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE INDEX "platform_audit_logs_entity_idx" ON "platform_audit_logs"("entity");

-- CreateIndex
CREATE INDEX "platform_audit_logs_entity_id_idx" ON "platform_audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "platform_audit_logs_actor_id_idx" ON "platform_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_company_id_distributor_id_idx" ON "inventory_movements"("company_id", "distributor_id");

-- CreateIndex
CREATE INDEX "sales_company_id_distributor_id_idx" ON "sales"("company_id", "distributor_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_balances" ADD CONSTRAINT "distributor_balances_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_deliveries" ADD CONSTRAINT "distributor_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_deliveries" ADD CONSTRAINT "distributor_deliveries_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: inicializar profile_complete segun el perfil actual (no degrada ningun plan existente)
UPDATE "companies"
SET "profile_complete" = TRUE,
    "profile_completed_at" = COALESCE("profile_completed_at", now())
WHERE "tax_id" ~ '^[0-9]{11}$'
  AND "legal_name" IS NOT NULL AND length("legal_name") >= 3
  AND "address" IS NOT NULL AND length("address") >= 10
  AND "phone" IS NOT NULL AND btrim("phone") <> ''
  AND "email" IS NOT NULL AND "email" LIKE '%@%';