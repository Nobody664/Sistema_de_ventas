BEGIN;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY is_global, company_id
    ORDER BY is_active DESC, updated_at DESC, id ASC
  ) AS position
  FROM invoice_templates WHERE is_default = TRUE
)
UPDATE invoice_templates SET is_default = FALSE
FROM ranked WHERE invoice_templates.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX "invoice_templates_one_company_default"
  ON invoice_templates(company_id)
  WHERE is_default = TRUE AND is_global = FALSE AND company_id IS NOT NULL;

CREATE UNIQUE INDEX "invoice_templates_one_global_default"
  ON invoice_templates(is_global)
  WHERE is_default = TRUE AND is_global = TRUE AND company_id IS NULL;

COMMIT;
