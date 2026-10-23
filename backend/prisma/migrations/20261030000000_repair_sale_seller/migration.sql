ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "seller_id" TEXT;
CREATE INDEX IF NOT EXISTS "sales_company_id_seller_id_idx" ON "sales"("company_id", "seller_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_seller_id_fkey' AND conrelid = 'sales'::regclass
  ) THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey"
      FOREIGN KEY ("seller_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
