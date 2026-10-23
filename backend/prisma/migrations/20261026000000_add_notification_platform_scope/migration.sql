ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "global_target" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "action_url" TEXT;
ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "scope" TEXT DEFAULT 'COMPANY';
CREATE INDEX IF NOT EXISTS "notifications_scope_is_read_created_at_idx" ON "notifications"("scope", "is_read", "created_at");