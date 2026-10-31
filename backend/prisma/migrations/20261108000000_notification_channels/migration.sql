ALTER TABLE "memberships" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'es', ADD COLUMN "daily_digest_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notifications" ADD COLUMN "push_queued_at" TIMESTAMP(3);
UPDATE "notifications" SET "push_queued_at"=CURRENT_TIMESTAMP;
CREATE INDEX "notifications_push_queued_at_created_at_idx" ON "notifications"("push_queued_at", "created_at");
CREATE TABLE "digest_deliveries" (
 "id" TEXT PRIMARY KEY, "membership_id" TEXT NOT NULL, "date_key" TEXT NOT NULL, "message" TEXT NOT NULL, "locale" TEXT NOT NULL DEFAULT 'es',
 "sent_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "digest_deliveries_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "digest_deliveries_membership_id_date_key_key" ON "digest_deliveries"("membership_id", "date_key");
CREATE TABLE "web_push_subscriptions" (
 "id" TEXT PRIMARY KEY, "membership_id" TEXT NOT NULL, "endpoint_hash" TEXT NOT NULL, "encrypted_subscription" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "web_push_subscriptions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_hash_key" ON "web_push_subscriptions"("endpoint_hash");
CREATE INDEX "web_push_subscriptions_membership_id_idx" ON "web_push_subscriptions"("membership_id");
CREATE TABLE "push_deliveries" (
 "id" TEXT PRIMARY KEY, "subscription_id" TEXT NOT NULL, "notification_id" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
 "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "locked_at" TIMESTAMP(3), "lease_token" TEXT, "finished_at" TIMESTAMP(3), "last_error" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "push_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "web_push_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "push_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "push_deliveries_subscription_id_notification_id_key" ON "push_deliveries"("subscription_id", "notification_id");
CREATE INDEX "push_deliveries_finished_at_available_at_idx" ON "push_deliveries"("finished_at", "available_at");
