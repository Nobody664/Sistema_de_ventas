-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "document_type" TEXT,
    "document_value" TEXT,
    "brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lead_time_days" INTEGER,
    "payment_terms" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "min_order_quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "supplier_sku" TEXT,
    "last_cost" DECIMAL(12,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "reference" TEXT,
    "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "total_estimated" DECIMAL(14,4),
    "sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "suggested_quantity" DECIMAL(14,3) NOT NULL,
    "requested_quantity" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(12,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_company_id_is_active_idx" ON "suppliers"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "suppliers_company_id_deleted_at_idx" ON "suppliers"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_name_key" ON "suppliers"("company_id", "name");

-- CreateIndex
CREATE INDEX "supplier_products_company_id_product_id_idx" ON "supplier_products"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "supplier_products_company_id_supplier_id_idx" ON "supplier_products"("company_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplier_id_product_id_key" ON "supplier_products"("supplier_id", "product_id");

-- CreateIndex
CREATE INDEX "supplier_orders_company_id_status_idx" ON "supplier_orders"("company_id", "status");

-- CreateIndex
CREATE INDEX "supplier_orders_company_id_supplier_id_idx" ON "supplier_orders"("company_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_order_items_order_id_idx" ON "supplier_order_items"("order_id");

-- CreateIndex
CREATE INDEX "supplier_order_items_product_id_idx" ON "supplier_order_items"("product_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supplier_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Row Level Security (deny-by-default for anon/authenticated; app uses postgres role which bypasses RLS)
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_order_items" ENABLE ROW LEVEL SECURITY;

