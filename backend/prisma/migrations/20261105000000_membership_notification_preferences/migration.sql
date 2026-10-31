ALTER TABLE "memberships"
  ADD COLUMN "notification_sales" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notification_stock" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notification_sound" BOOLEAN NOT NULL DEFAULT true;
