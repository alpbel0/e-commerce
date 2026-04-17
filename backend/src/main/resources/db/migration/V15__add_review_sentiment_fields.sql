ALTER TABLE reviews
ADD COLUMN sentiment_score DECIMAL(5, 4),
ADD COLUMN sentiment_label VARCHAR(16);

ALTER TABLE reviews
ADD CONSTRAINT reviews_sentiment_label_check
CHECK (sentiment_label IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE') OR sentiment_label IS NULL);
