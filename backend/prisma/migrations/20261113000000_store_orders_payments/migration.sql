ALTER TABLE sales ADD COLUMN shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD CONSTRAINT sales_company_id_id_key UNIQUE(company_id,id);
CREATE TYPE "StoreOrderState" AS ENUM ('PENDING_PAYMENT','CONFIRMED','CANCELLED','EXPIRED','REVIEW_REQUIRED','COMPLETED');
ALTER TABLE store_quotes ADD CONSTRAINT store_quotes_company_id_account_id_id_key UNIQUE(company_id,account_id,id);
CREATE TABLE store_orders (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, account_id TEXT NOT NULL, quote_id TEXT NOT NULL UNIQUE,
 number TEXT NOT NULL, idempotency_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
 status "StoreOrderState" NOT NULL DEFAULT 'PENDING_PAYMENT', payment_status TEXT NOT NULL DEFAULT 'PENDING', fulfillment TEXT NOT NULL DEFAULT 'UNFULFILLED',
 payment_reference TEXT, snapshot JSONB NOT NULL, total_amount DECIMAL(12,2) NOT NULL CHECK(total_amount >= 0), version INTEGER NOT NULL DEFAULT 1,
 expires_at TIMESTAMP(3) NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, sale_id TEXT UNIQUE,
 refund_requested_at TIMESTAMP(3), refund_reason TEXT, tracking_code TEXT,
 UNIQUE(company_id,id), UNIQUE(company_id,account_id,id), UNIQUE(company_id,account_id,quote_id), UNIQUE(company_id,sale_id), UNIQUE(company_id,number), UNIQUE(company_id,account_id,idempotency_key),
 FOREIGN KEY(company_id,account_id) REFERENCES customer_accounts(company_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(company_id,sale_id) REFERENCES sales(company_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(company_id,account_id,quote_id) REFERENCES store_quotes(company_id,account_id,id) ON DELETE RESTRICT
);
CREATE INDEX store_orders_company_id_account_id_created_at_idx ON store_orders(company_id,account_id,created_at);
CREATE INDEX store_orders_status_expires_at_idx ON store_orders(status,expires_at);
ALTER TABLE stock_reservations ADD CONSTRAINT store_reservations_owner_fkey FOREIGN KEY(company_id,owner_id) REFERENCES store_orders(company_id,id) ON DELETE RESTRICT;
CREATE TABLE store_payment_proofs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, order_id TEXT NOT NULL, encrypted_image TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(company_id,order_id) REFERENCES store_orders(company_id,id) ON DELETE RESTRICT);
CREATE INDEX store_payment_proofs_order_id_idx ON store_payment_proofs(order_id);
CREATE TABLE store_order_history (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, order_id TEXT NOT NULL, version INTEGER NOT NULL, actor_id TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(order_id,version), FOREIGN KEY(company_id,order_id) REFERENCES store_orders(company_id,id) ON DELETE RESTRICT);
CREATE TABLE store_notifications (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, account_id TEXT NOT NULL, order_id TEXT NOT NULL, version INTEGER NOT NULL, message TEXT NOT NULL, read_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(order_id,version), FOREIGN KEY(company_id,account_id) REFERENCES customer_accounts(company_id,id) ON DELETE RESTRICT, FOREIGN KEY(company_id,account_id,order_id) REFERENCES store_orders(company_id,account_id,id) ON DELETE RESTRICT);
CREATE INDEX store_notifications_account_id_created_at_idx ON store_notifications(account_id,created_at);
CREATE TABLE store_payment_integrations (company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT, public_id TEXT NOT NULL UNIQUE, encrypted_token TEXT NOT NULL, encrypted_webhook_secret TEXT NOT NULL, merchant_id TEXT NOT NULL, live_mode BOOLEAN NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE store_payment_attempts (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES store_payment_integrations(company_id) ON DELETE RESTRICT, order_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'PENDING', provider_payment_id TEXT, redirect_url TEXT, preference_id TEXT, lease_until TIMESTAMP(3), UNIQUE(company_id,provider_payment_id), FOREIGN KEY(company_id,order_id) REFERENCES store_orders(company_id,id) ON DELETE RESTRICT);
CREATE TABLE store_payment_events (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT, provider_payment_id TEXT NOT NULL, event_key TEXT NOT NULL, detail JSONB NOT NULL, requires_review BOOLEAN NOT NULL DEFAULT false, received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(company_id,provider_payment_id,event_key));
CREATE TABLE store_refunds (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, order_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'PENDING', amount DECIMAL(12,2) NOT NULL, reference TEXT, restocked_at TIMESTAMP(3), FOREIGN KEY(company_id,order_id) REFERENCES store_orders(company_id,id) ON DELETE RESTRICT);
ALTER TABLE store_refunds ADD CONSTRAINT store_refunds_company_id_order_id_key UNIQUE(company_id,order_id);
ALTER TABLE store_payment_attempts ADD CONSTRAINT store_payment_attempts_company_id_order_id_key UNIQUE(company_id,order_id);
