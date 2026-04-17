-- Add slug column to stores for friendly URL support
ALTER TABLE stores ADD COLUMN slug VARCHAR(255) UNIQUE;

-- Generate slugs from store names for existing stores
UPDATE stores SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;

-- Ensure all stores have a slug (append uuid suffix if duplicate)
DO $$
DECLARE
    r RECORD;
    counter INT := 1;
BEGIN
    FOR r IN SELECT id, slug FROM stores WHERE slug IS NULL OR slug = '' LOOP
        UPDATE stores SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(r.id::TEXT, 1, 8) WHERE id = r.id;
    END LOOP;
END;
$$;

ALTER TABLE stores ALTER COLUMN slug SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
