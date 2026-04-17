CREATE TABLE currency_rates (
    id SERIAL PRIMARY KEY,
    base_currency VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(18, 6) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(base_currency, target_currency)
);

INSERT INTO currency_rates (base_currency, target_currency, rate)
VALUES
    ('USD', 'TRY', 44.710000),
    ('USD', 'GBP', 0.743000),
    ('USD', 'PKR', 279.350000),
    ('USD', 'INR', 93.340000),
    ('USD', 'CAD', 1.383000),
    ('USD', 'AUD', 1.420000),
    ('USD', 'EUR', 0.855000),
    ('USD', 'USD', 1.000000);
