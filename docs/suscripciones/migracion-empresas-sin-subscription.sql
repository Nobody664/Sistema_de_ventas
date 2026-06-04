-- Migración: Asignar plan FREE a empresas existentes sin suscripción
-- Ejecutar después de deployar los cambios de CompaniesService.create()
--
-- Uso: psql "$DATABASE_URL" -f migracion-empresas-sin-subscription.sql

DO $$
DECLARE
    free_plan_id VARCHAR;
    company_record RECORD;
BEGIN
    -- Obtener el ID del plan FREE
    SELECT id INTO free_plan_id FROM "Plan" WHERE code = 'FREE';
    
    IF free_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plan FREE no encontrado. Ejecuta primero el seed.';
    END IF;

    FOR company_record IN
        SELECT c.id, c.name
        FROM "Company" c
        WHERE NOT EXISTS (
            SELECT 1 FROM "Subscription" s WHERE s."company_id" = c.id
        )
    LOOP
        INSERT INTO "Subscription" (
            id,
            company_id,
            plan_id,
            status,
            provider,
            billing_cycle,
            start_date,
            end_date,
            auto_renew,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid()::text,
            company_record.id,
            free_plan_id,
            'TRIALING',
            'CASH',
            'MONTHLY',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '7 days',
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );

        -- Actualizar empresa a TRIAL si estaba sin estado definido
        UPDATE "Company"
        SET status = 'TRIAL',
            trial_ends_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
        WHERE id = company_record.id
          AND status IS NULL;
    END LOOP;
END $$;

-- Verificación
SELECT 
    c.name as empresa,
    c.status as estado_company,
    s.status as estado_subscription,
    p.code as plan_code,
    p.name as plan_name,
    s.end_date as trial_fin
FROM "Company" c
LEFT JOIN "Subscription" s ON s.company_id = c.id
LEFT JOIN "Plan" p ON p.id = s.plan_id
ORDER BY c.created_at DESC;
