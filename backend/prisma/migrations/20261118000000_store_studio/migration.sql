ALTER TABLE memberships ADD CONSTRAINT memberships_company_id_id_key UNIQUE(company_id,id);
CREATE TABLE store_admin_features (
 company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT,
 appearance BOOLEAN NOT NULL DEFAULT false, notes BOOLEAN NOT NULL DEFAULT false, saved_views BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0)
);
CREATE TABLE store_appearance (
 company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT,
 schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version = 1), draft JSONB NOT NULL, published JSONB, previous_published JSONB,
 draft_version INTEGER NOT NULL DEFAULT 1 CHECK(draft_version > 0), published_version INTEGER CHECK(published_version > 0),
 updated_by_membership_id TEXT NOT NULL, published_at TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL,
 FOREIGN KEY(company_id,updated_by_membership_id) REFERENCES memberships(company_id,id) ON DELETE RESTRICT
);
CREATE TABLE store_media_assets (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT, uploaded_by_membership_id TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('LOGO','HERO')), state TEXT NOT NULL DEFAULT 'READY' CHECK(state IN ('PROCESSING','READY','REJECTED','ARCHIVED')),
 storage_key TEXT NOT NULL UNIQUE, mime_type VARCHAR(64) NOT NULL CHECK(mime_type = 'image/webp'),
 byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 1000000), width INTEGER NOT NULL CHECK(width > 0 AND width <= 1600), height INTEGER NOT NULL CHECK(height > 0 AND height <= 1600),
 checksum CHAR(64) NOT NULL, content BYTEA NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, archived_at TIMESTAMP(3),
 UNIQUE(company_id,id), CHECK(octet_length(content) = byte_size),
 FOREIGN KEY(company_id,uploaded_by_membership_id) REFERENCES memberships(company_id,id) ON DELETE RESTRICT
);
CREATE INDEX store_media_assets_company_purpose_state_date_idx ON store_media_assets(company_id,purpose,state,created_at);
CREATE TABLE store_order_internal_notes (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, order_id TEXT NOT NULL, author_membership_id TEXT NOT NULL,
 body VARCHAR(2000) NOT NULL CHECK(length(trim(body)) > 0), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(company_id,order_id) REFERENCES store_orders(company_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(company_id,author_membership_id) REFERENCES memberships(company_id,id) ON DELETE RESTRICT
);
CREATE INDEX store_internal_notes_order_date_idx ON store_order_internal_notes(company_id,order_id,created_at,id);
CREATE TABLE store_saved_views (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, membership_id TEXT NOT NULL,
 resource TEXT NOT NULL CHECK(resource IN ('ORDERS','CATALOG','CUSTOMERS')), name VARCHAR(80) NOT NULL CHECK(length(trim(name)) > 0),
 schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version = 1), definition JSONB NOT NULL, is_default BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL,
 UNIQUE(company_id,membership_id,resource,name),
 FOREIGN KEY(company_id,membership_id) REFERENCES memberships(company_id,id) ON DELETE CASCADE
);
CREATE INDEX store_saved_views_membership_resource_idx ON store_saved_views(company_id,membership_id,resource);
CREATE UNIQUE INDEX store_saved_views_one_default ON store_saved_views(company_id,membership_id,resource) WHERE is_default = true;
