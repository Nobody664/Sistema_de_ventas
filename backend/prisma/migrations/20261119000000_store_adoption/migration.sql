ALTER TABLE store_admin_features ADD COLUMN experience_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE store_admin_features ADD COLUMN experience_version INTEGER NOT NULL DEFAULT 1 CHECK(experience_version > 0);
