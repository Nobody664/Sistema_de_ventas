ALTER TABLE "Sale" ADD COLUMN "sellerId" TEXT;
CREATE INDEX "Sale_companyId_sellerId_idx" ON "Sale"("companyId","sellerId");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;