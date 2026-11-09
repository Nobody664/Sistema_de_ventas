CREATE INDEX IF NOT EXISTS store_orders_company_inbox_idx ON store_orders(company_id,created_at DESC,id DESC);
