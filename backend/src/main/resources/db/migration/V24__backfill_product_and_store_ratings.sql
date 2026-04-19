WITH product_review_stats AS (
    SELECT
        r.product_id,
        COUNT(*)::INT AS review_count,
        ROUND(AVG(r.star_rating)::numeric, 2) AS avg_rating
    FROM reviews r
    WHERE r.is_active = true
    GROUP BY r.product_id
)
UPDATE products p
SET review_count = COALESCE(prs.review_count, 0),
    avg_rating = prs.avg_rating
FROM product_review_stats prs
WHERE p.id = prs.product_id;

UPDATE products p
SET review_count = 0,
    avg_rating = NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM reviews r
    WHERE r.product_id = p.id
      AND r.is_active = true
);

WITH store_review_stats AS (
    SELECT
        p.store_id,
        ROUND(AVG(r.star_rating)::numeric, 2) AS rating
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    WHERE r.is_active = true
    GROUP BY p.store_id
)
UPDATE stores s
SET rating = srs.rating
FROM store_review_stats srs
WHERE s.id = srs.store_id;

UPDATE stores s
SET rating = NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    WHERE p.store_id = s.id
      AND r.is_active = true
);
