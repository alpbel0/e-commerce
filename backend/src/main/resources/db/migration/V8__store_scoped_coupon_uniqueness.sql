ALTER TABLE coupons
DROP CONSTRAINT IF EXISTS coupons_code_key;

DROP INDEX IF EXISTS idx_coupons_code;

CREATE UNIQUE INDEX ux_coupons_store_code_ci
ON coupons (store_id, LOWER(code));
