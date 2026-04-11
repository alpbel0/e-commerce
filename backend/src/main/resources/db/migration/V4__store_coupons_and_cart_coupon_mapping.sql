ALTER TABLE coupons
ADD COLUMN store_id UUID;

UPDATE coupons
SET store_id = (
    SELECT id
    FROM stores
    ORDER BY created_at ASC
    LIMIT 1
)
WHERE store_id IS NULL;

ALTER TABLE coupons
ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE coupons
ADD CONSTRAINT fk_coupons_store
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX idx_coupons_store_id ON coupons(store_id);

CREATE TABLE cart_store_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, store_id),
    UNIQUE(cart_id, coupon_id)
);

CREATE INDEX idx_cart_store_coupons_cart_id ON cart_store_coupons(cart_id);
CREATE INDEX idx_cart_store_coupons_store_id ON cart_store_coupons(store_id);
CREATE INDEX idx_cart_store_coupons_coupon_id ON cart_store_coupons(coupon_id);
