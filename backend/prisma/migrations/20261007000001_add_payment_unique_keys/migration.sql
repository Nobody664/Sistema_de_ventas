-- Claves unicas en payments para deduplicar pagos (webhook MP y flujos offline).
-- 1) Limpiar duplicados historicos conservando la fila mas antigua (id menor si empata en ms).
DELETE FROM "payments" a
USING "payments" b
WHERE a."provider_payment_id" IS NOT NULL
  AND a."provider_payment_id" = b."provider_payment_id"
  AND (a."created_at" > b."created_at" OR (a."created_at" = b."created_at" AND a."id" > b."id"));

DELETE FROM "payments" a
USING "payments" b
WHERE a."transaction_id" IS NOT NULL
  AND a."transaction_id" = b."transaction_id"
  AND (a."created_at" > b."created_at" OR (a."created_at" = b."created_at" AND a."id" > b."id"));

-- 2) Indices unicos (Postgres permite multiples NULL).
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");