UPDATE "plans"
SET "modules" = "modules" - 'payments'
WHERE "modules" IS NOT NULL AND "modules" ? 'payments';
