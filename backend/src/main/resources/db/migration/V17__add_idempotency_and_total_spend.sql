-- Add idempotency_key to orders table for checkout idempotency
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL;

-- Add unique constraint on idempotency_key per user (allows null for existing orders)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_idempotency_key
    ON orders (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Add total_spend to users table for tracking user lifetime spending
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spend DECIMAL(19, 2) NOT NULL DEFAULT 0.00;
