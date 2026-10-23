-- Claves de idempotencia para evitar duplicados en flujos sensibles.
-- CheckoutRequest: mismo "idempotencyKey" => se retorna la solicitud existente.
-- PlanUpgradeRequest: mismo "idempotencyKey" => se retorna la solicitud existente.
-- Columnas aditivas y seguras: las uniques aceptan multiples NULL en Postgres.
-- Generada manualmente (migrate diff requiere red a la DB, no disponible en sandbox).
ALTER TABLE "checkout_requests" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "plan_upgrade_requests" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "checkout_requests_idempotency_key_key" ON "checkout_requests"("idempotency_key");
CREATE UNIQUE INDEX "plan_upgrade_requests_idempotency_key_key" ON "plan_upgrade_requests"("idempotency_key");