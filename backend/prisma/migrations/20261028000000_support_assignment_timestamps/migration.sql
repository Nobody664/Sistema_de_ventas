ALTER TABLE "support_tickets" ADD COLUMN "assigned_at" TIMESTAMP(3);
ALTER TABLE "support_conversations"
  ADD COLUMN "assigned_at" TIMESTAMP(3),
  ADD COLUMN "first_response_at" TIMESTAMP(3);
