CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id),
    provider VARCHAR(50) NOT NULL,
    provider_payment_intent_id VARCHAR(255) UNIQUE,
    provider_charge_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL,
    failure_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (provider IN ('STRIPE')),
    CHECK (status IN ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'))
);

CREATE TABLE payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id),
    provider_refund_id VARCHAR(255) UNIQUE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(50) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED'))
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payment_refunds_payment_id ON payment_refunds(payment_id);
CREATE UNIQUE INDEX idx_payment_refunds_order_item_id ON payment_refunds(order_item_id) WHERE order_item_id IS NOT NULL;

INSERT INTO payment_methods (code, name, is_active)
VALUES
    ('STRIPE_CARD', 'Stripe Card', TRUE),
    ('CREDIT_CARD', 'Credit Card', TRUE),
    ('DEBIT_CARD', 'Debit Card', TRUE),
    ('PAYPAL', 'PayPal', TRUE),
    ('WIRE_TRANSFER', 'Wire Transfer', TRUE),
    ('CASH_ON_DELIVERY', 'Cash on Delivery', TRUE)
ON CONFLICT (code) DO NOTHING;
