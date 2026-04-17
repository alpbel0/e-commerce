ALTER TABLE products
ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';

UPDATE products p
SET currency = CASE
    WHEN s.name = 'ONLINE_RETAIL_STORE' THEN 'GBP'
    WHEN s.name = 'PAKISTAN_STORE' THEN 'PKR'
    WHEN s.name LIKE 'AMAZON_STORE_%' THEN 'USD'
    ELSE 'USD'
END
FROM stores s
WHERE p.store_id = s.id;
