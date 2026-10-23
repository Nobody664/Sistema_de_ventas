UPDATE "plans" SET
  "modules" = '["dashboard","notifications","products","categories","inventory","sales","customers"]'::jsonb,
  "permissions" = '["reports.basic","sales.discounts"]'::jsonb,
  "api_enabled" = false,
  "api_search_dni_enabled" = false,
  "api_quota" = 0
WHERE code = 'FREE';

UPDATE "plans" SET
  "modules" = '["dashboard","notifications","products","categories","inventory","sales","customers","distributors","employees","payments","reports"]'::jsonb,
  "permissions" = '["reports.basic","reports.export","sales.discounts","inventory.kardex"]'::jsonb,
  "api_enabled" = false,
  "api_search_dni_enabled" = false,
  "api_quota" = 0
WHERE code = 'START';

UPDATE "plans" SET
  "modules" = '["dashboard","notifications","products","categories","inventory","sales","customers","distributors","employees","payments","reports","api"]'::jsonb,
  "permissions" = '["reports.basic","reports.advanced","reports.export","sales.discounts","inventory.kardex","inventory.batches","inventory.multi_branch","api.access"]'::jsonb,
  "api_enabled" = true,
  "api_search_dni_enabled" = false,
  "api_quota" = 10000
WHERE code = 'GROWTH';

UPDATE "plans" SET
  "modules" = '["dashboard","notifications","products","categories","inventory","sales","customers","distributors","employees","payments","reports","api","api_search_dni","webhooks"]'::jsonb,
  "permissions" = '["reports.basic","reports.advanced","reports.export","sales.discounts","inventory.kardex","inventory.batches","inventory.multi_branch","api.access","api.dni_search","webhooks.manage","users.manage"]'::jsonb,
  "api_enabled" = true,
  "api_search_dni_enabled" = true,
  "api_quota" = 100000
WHERE code = 'SCALE';
