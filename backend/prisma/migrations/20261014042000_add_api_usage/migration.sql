CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_usage_company_id_period_key" ON "api_usage"("company_id", "period");

CREATE INDEX "api_usage_company_id_idx" ON "api_usage"("company_id");

ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
