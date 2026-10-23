-- Baseline migration: snapshot completo de prisma/schema.prisma.
-- Generada con: prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- Reemplaza a 20260929020715_init_back (squash). No borra datos: solo crea el esquema inicial.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'PAST_DUE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MERCADOPAGO', 'PAYPAL', 'CASH', 'CARD', 'TRANSFER', 'YAPE', 'PLIN');

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'REFUNDED', 'PENDING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SALE', 'PAYMENT', 'INVENTORY', 'SUBSCRIPTION', 'SYSTEM', 'PLAN_UPGRADED', 'PLAN_UPGRADE_REQUEST', 'SUBSCRIPTION_APPROVED', 'SUBSCRIPTION_REJECTED', 'SUBSCRIPTION_PENDING', 'LOW_STOCK', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'PAYMENT_PROOF_PENDING', 'NEW_COMPANY_REGISTRATION', 'CHECKOUT_REQUEST_PENDING', 'ACCOUNT_ACTIVATED', 'ACCOUNT_APPROVED', 'TRIAL_EXPIRING_SOON', 'TRIAL_EXPIRED', 'NEW_SALE', 'NEW_CUSTOMER', 'SALE_COMPLETED', 'SALE_RETURNED', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "PlanUpgradeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckoutRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'LOSS', 'TRANSFER');

-- CreateEnum
CREATE TYPE "InventoryCostMethod" AS ENUM ('FIFO', 'WEIGHTED_AVERAGE');

-- CreateEnum
CREATE TYPE "RefreshTokenType" AS ENUM ('SESSION', 'RESET');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legal_name" TEXT,
    "tax_id" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Lima',
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "status" "CompanyStatus" NOT NULL DEFAULT 'TRIAL',
    "inventory_cost_method" "InventoryCostMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_yearly" DECIMAL(10,2) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "maxProducts" INTEGER NOT NULL DEFAULT 100,
    "features" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'CASH',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "provider_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'CASHIER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "document_type" TEXT,
    "document_value" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "sale_price" DECIMAL(10,2) NOT NULL,
    "cost_price" DECIMAL(10,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 5,
    "reorder_point" INTEGER,
    "safety_stock" INTEGER,
    "lead_time_days" INTEGER,
    "last_sold_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" TEXT,
    "barcode" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "employee_id" TEXT,
    "sale_number" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2),
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentProvider" NOT NULL DEFAULT 'CASH',
    "paid_amount" DECIMAL(12,2) NOT NULL,
    "change_amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dni" TEXT,
    "role" "MembershipRole" NOT NULL DEFAULT 'CASHIER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_batches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "batch_number" TEXT NOT NULL,
    "quantity_received" INTEGER NOT NULL,
    "quantity_available" INTEGER NOT NULL,
    "purchase_price" DECIMAL(10,2) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_kardex" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "movement_id" TEXT,
    "movement_date" TIMESTAMP(3) NOT NULL,
    "movement_type" TEXT NOT NULL,
    "qty_in" INTEGER NOT NULL DEFAULT 0,
    "unit_cost_in" DECIMAL(10,2),
    "total_cost_in" DECIMAL(12,2),
    "qty_out" INTEGER NOT NULL DEFAULT 0,
    "unit_cost_out" DECIMAL(10,2),
    "total_cost_out" DECIMAL(12,2),
    "balance_qty" INTEGER NOT NULL,
    "balance_unit_cost" DECIMAL(10,2) NOT NULL,
    "balance_total_cost" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_kardex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'CASH',
    "provider_payment_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "providerPayload" JSONB,
    "paid_at" TIMESTAMP(3),
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_upgrade_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "current_plan_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "provider" "PaymentProvider" DEFAULT 'CASH',
    "amount" TEXT,
    "currency" TEXT DEFAULT 'PEN',
    "status" "PlanUpgradeStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "proof_image_base64" TEXT,
    "payment_date" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "type" TEXT DEFAULT 'BOLETA',
    "description" TEXT,
    "header_text" TEXT,
    "logo_url" TEXT,
    "company_ruc" TEXT,
    "company_address" TEXT,
    "company_phone" TEXT,
    "show_logo" BOOLEAN NOT NULL DEFAULT true,
    "show_company" BOOLEAN NOT NULL DEFAULT true,
    "show_customer" BOOLEAN NOT NULL DEFAULT true,
    "show_employee" BOOLEAN NOT NULL DEFAULT false,
    "show_items" BOOLEAN NOT NULL DEFAULT true,
    "show_subtotal" BOOLEAN NOT NULL DEFAULT true,
    "show_tax" BOOLEAN NOT NULL DEFAULT true,
    "show_discount" BOOLEAN NOT NULL DEFAULT true,
    "show_sale_number" BOOLEAN NOT NULL DEFAULT true,
    "show_sale_date" BOOLEAN NOT NULL DEFAULT true,
    "show_sale_time" BOOLEAN NOT NULL DEFAULT false,
    "show_payment_method" BOOLEAN NOT NULL DEFAULT true,
    "footer_text" TEXT,
    "tax_percentage" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "custom_fields" JSONB,
    "font_family" TEXT NOT NULL DEFAULT 'Arial',
    "font_size" INTEGER NOT NULL DEFAULT 12,
    "paper_size" TEXT NOT NULL DEFAULT 'A4',

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "config" JSONB NOT NULL,
    "qr_image_base64" TEXT,
    "account_number" TEXT,
    "account_name" TEXT,
    "instructions" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "status" "CheckoutRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "proof_image_base64" TEXT,
    "review_notes" TEXT,
    "payment_date" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "user_id" TEXT,
    "subscription_id" TEXT,
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "image_base64" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "type" "RefreshTokenType" NOT NULL DEFAULT 'SESSION',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_end_date_idx" ON "subscriptions"("status", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_company_id_key" ON "subscriptions"("company_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "memberships_company_id_idx" ON "memberships"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_company_id_key" ON "memberships"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");

-- CreateIndex
CREATE INDEX "customers_company_id_deleted_at_idx" ON "customers"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_email_key" ON "customers"("company_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_document_value_key" ON "customers"("company_id", "document_value");

-- CreateIndex
CREATE INDEX "categories_company_id_deleted_at_idx" ON "categories"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_company_id_slug_key" ON "categories"("company_id", "slug");

-- CreateIndex
CREATE INDEX "products_company_id_is_active_idx" ON "products"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "products_company_id_deleted_at_idx" ON "products"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_sku_key" ON "products"("company_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_barcode_key" ON "products"("company_id", "barcode");

-- CreateIndex
CREATE INDEX "sales_company_id_created_at_idx" ON "sales"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_company_id_status_idx" ON "sales"("company_id", "status");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- CreateIndex
CREATE INDEX "sales_employee_id_idx" ON "sales"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_company_id_sale_number_key" ON "sales"("company_id", "sale_number");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_sale_id_product_id_key" ON "sale_items"("sale_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_company_id_idx" ON "employees"("company_id");

-- CreateIndex
CREATE INDEX "employees_company_id_deleted_at_idx" ON "employees"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_dni_key" ON "employees"("company_id", "dni");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "branches"("company_id");

-- CreateIndex
CREATE INDEX "product_batches_company_id_product_id_idx" ON "product_batches"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "product_batches_expiration_date_idx" ON "product_batches"("expiration_date");

-- CreateIndex
CREATE INDEX "product_batches_product_id_idx" ON "product_batches"("product_id");

-- CreateIndex
CREATE INDEX "product_batches_branch_id_idx" ON "product_batches"("branch_id");

-- CreateIndex
CREATE INDEX "inventory_kardex_company_id_product_id_movement_date_idx" ON "inventory_kardex"("company_id", "product_id", "movement_date");

-- CreateIndex
CREATE INDEX "inventory_kardex_company_id_movement_date_idx" ON "inventory_kardex"("company_id", "movement_date");

-- CreateIndex
CREATE INDEX "inventory_kardex_product_id_idx" ON "inventory_kardex"("product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_company_id_product_id_idx" ON "inventory_movements"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_company_id_branch_id_idx" ON "inventory_movements"("company_id", "branch_id");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_type_idx" ON "inventory_movements"("product_id", "type");

-- CreateIndex
CREATE INDEX "inventory_movements_branch_id_type_idx" ON "inventory_movements"("branch_id", "type");

-- CreateIndex
CREATE INDEX "payments_subscription_id_status_idx" ON "payments"("subscription_id", "status");

-- CreateIndex
CREATE INDEX "plan_upgrade_requests_company_id_idx" ON "plan_upgrade_requests"("company_id");

-- CreateIndex
CREATE INDEX "plan_upgrade_requests_plan_id_idx" ON "plan_upgrade_requests"("plan_id");

-- CreateIndex
CREATE INDEX "invoice_templates_company_id_idx" ON "invoice_templates"("company_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_company_id_idx" ON "notifications"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settings_provider_key" ON "payment_settings"("provider");

-- CreateIndex
CREATE INDEX "checkout_requests_company_id_idx" ON "checkout_requests"("company_id");

-- CreateIndex
CREATE INDEX "checkout_requests_plan_id_idx" ON "checkout_requests"("plan_id");

-- CreateIndex
CREATE INDEX "payment_proofs_subscription_id_idx" ON "payment_proofs"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_company_id_idx" ON "refresh_tokens"("company_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

