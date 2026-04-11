ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE review_responses
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE reviews
SET is_active = TRUE
WHERE is_active IS NULL;

UPDATE review_responses
SET is_active = TRUE
WHERE is_active IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_active_user_product
    ON reviews(user_id, product_id)
    WHERE is_active = TRUE AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_responses_active_review
    ON review_responses(review_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_reviews_product_active_created_at
    ON reviews(product_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_responses_review_active_created_at
    ON review_responses(review_id, is_active, created_at ASC);
