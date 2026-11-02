UPDATE plans p SET
  modules = (
    SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
    FROM jsonb_array_elements((CASE WHEN jsonb_typeof(p.modules) = 'array' THEN p.modules ELSE '[]'::jsonb END) || '["storefront","api_search_dni"]'::jsonb)
    WHERE jsonb_typeof(value) = 'string'
  ),
  permissions = (
    SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
    FROM jsonb_array_elements((CASE WHEN jsonb_typeof(p.permissions) = 'array' THEN p.permissions ELSE '[]'::jsonb END) || '["api.dni_search"]'::jsonb)
    WHERE jsonb_typeof(value) = 'string'
  ),
  api_enabled = true,
  api_search_dni_enabled = true,
  api_quota = CASE
    WHEN upper(code) IN ('START','STARTUP') THEN 500
    WHEN upper(code) IN ('GROWTH','MEDIO','MEDIUM') THEN 1500
    WHEN upper(code) IN ('SCALE','PRO','PROFESIONAL','PROFESSIONAL') THEN 3000
    WHEN api_quota > 0 THEN api_quota
    ELSE 500
  END
WHERE price_monthly > 0 OR price_yearly > 0;
