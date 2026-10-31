CREATE TABLE "webhook_endpoints" (
 "id" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL, "membership_id" TEXT NOT NULL,
 "name" TEXT NOT NULL, "url" TEXT NOT NULL, "encrypted_secret" TEXT NOT NULL,
 "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "webhook_endpoints_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "webhook_endpoints_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "webhook_endpoints_company_id_created_at_idx" ON "webhook_endpoints"("company_id", "created_at");
CREATE TABLE "webhook_deliveries" (
 "id" TEXT PRIMARY KEY, "endpoint_id" TEXT NOT NULL, "event_id" TEXT NOT NULL, "payload" JSONB NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0, "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "locked_at" TIMESTAMP(3), "lease_token" TEXT, "delivered_at" TIMESTAMP(3), "stopped_at" TIMESTAMP(3), "status_code" INTEGER, "last_error" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "webhook_deliveries_endpoint_id_event_id_key" ON "webhook_deliveries"("endpoint_id", "event_id");
CREATE INDEX "webhook_deliveries_delivered_at_stopped_at_available_at_idx" ON "webhook_deliveries"("delivered_at", "stopped_at", "available_at");
