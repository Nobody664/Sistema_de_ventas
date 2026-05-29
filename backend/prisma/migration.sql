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
CREATE TYPE "GlobalRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'REFUNDED', 'PENDING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SALE', 'PAYMENT', 'INVENTORY', 'SUBSCRIPTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "PlanUpgradeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckoutRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
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
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" TEXT,
    "barcode" TEXT,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_company_id_key" ON "subscriptions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_company_id_key" ON "memberships"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_company_id_slug_key" ON "categories"("company_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "sales_sale_number_key" ON "sales"("sale_number");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_sale_id_product_id_key" ON "sale_items"("sale_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_dni_key" ON "employees"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settings_company_id_provider_key" ON "payment_settings"("company_id", "provider");

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.8.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
