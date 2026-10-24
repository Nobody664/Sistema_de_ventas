CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_revoked_at_idx" ON "refresh_tokens"("family_id", "revoked_at");
