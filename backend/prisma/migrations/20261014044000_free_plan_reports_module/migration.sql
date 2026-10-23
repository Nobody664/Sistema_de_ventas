-- El plan FREE incluye "Reportes: Básico" (permiso reports.basic), por lo que
-- su módulo "reports" debe estar habilitado. Idempotente: solo agrega si falta.
UPDATE "plans"
SET "modules" = "modules" || '["reports"]'::jsonb
WHERE code = 'FREE'
  AND NOT ("modules" @> '["reports"]'::jsonb);
