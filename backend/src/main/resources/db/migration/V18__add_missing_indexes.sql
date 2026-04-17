-- Add missing indexes for query performance

-- Index on products.unit_price for price filtering/range queries
CREATE INDEX idx_products_unit_price ON products(unit_price);

-- Index on orders.grand_total for analytics queries and sorting
CREATE INDEX idx_orders_grand_total ON orders(grand_total);

-- Composite index on products(store_id, category_id) for category-scoped store queries
CREATE INDEX idx_products_store_category ON products(store_id, category_id);
