CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL PRIMARY KEY, "dedupe_key" TEXT NOT NULL,
  "kind" TEXT NOT NULL, "aggregate_id" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3), "lease_token" TEXT, "processed_at" TIMESTAMP(3), "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");
CREATE INDEX "outbox_events_processed_at_available_at_idx" ON "outbox_events"("processed_at", "available_at");
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
ALTER TABLE "payment_proofs" ADD COLUMN "payment_id" TEXT;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "payment_proofs_one_pending_per_payment" ON "payment_proofs"("payment_id") WHERE "status" = 'PENDING';
ALTER TABLE "checkout_requests" ADD COLUMN "billing_cycle" "BillingCycle";
