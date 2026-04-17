from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from db import get_connection
from utils import append_run_log

BATCH_SIZE = 1000
TEXT_WEIGHT = Decimal("0.7")
RATING_WEIGHT = Decimal("0.3")
POSITIVE_THRESHOLD = Decimal("0.25")
NEGATIVE_THRESHOLD = Decimal("-0.25")


def rating_to_score(star_rating: int) -> Decimal:
    mapping = {
        1: Decimal("-1.0"),
        2: Decimal("-0.5"),
        3: Decimal("0.0"),
        4: Decimal("0.5"),
        5: Decimal("1.0"),
    }
    return mapping.get(int(star_rating), Decimal("0.0"))


def score_to_label(score: Decimal) -> str:
    if score >= POSITIVE_THRESHOLD:
        return "POSITIVE"
    if score <= NEGATIVE_THRESHOLD:
        return "NEGATIVE"
    return "NEUTRAL"


def normalize_text_score(value: Decimal | float | str | None) -> Decimal:
    if value is None:
        return Decimal("0.0")
    score = Decimal(str(value))
    if score > Decimal("1.0"):
        score = Decimal("1.0")
    if score < Decimal("-1.0"):
        score = Decimal("-1.0")
    return score


def main() -> None:
    print("Fetching reviews for hybrid sentiment backfill...")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, star_rating, text_score
                FROM reviews
                WHERE text_score IS NOT NULL
                """
            )
            rows = cur.fetchall()

    total = len(rows)
    updated = 0

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        updates: list[tuple] = []

        for review_id, star_rating, text_score in batch:
            text_component = normalize_text_score(text_score)
            rating_component = rating_to_score(star_rating)
            final_score = ((TEXT_WEIGHT * text_component) + (RATING_WEIGHT * rating_component)).quantize(
                Decimal("0.0001"),
                rounding=ROUND_HALF_UP,
            )
            sentiment_label = score_to_label(final_score)
            updates.append((final_score, sentiment_label, review_id))

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    UPDATE reviews
                    SET sentiment_score = %s,
                        sentiment_label = %s
                    WHERE id = %s
                    """,
                    updates,
                )

        updated += len(updates)
        processed = min(i + BATCH_SIZE, total)
        if processed % 5000 == 0 or processed == total:
            print(f"  Progress: {processed}/{total} ({updated} updated)")

    append_run_log(
        [
            "phase=5",
            "step=backfill_review_sentiment",
            f"total={total}",
            f"updated={updated}",
            f"text_weight={TEXT_WEIGHT}",
            f"rating_weight={RATING_WEIGHT}",
        ]
    )
    print(
        "BACKFILL COMPLETE: "
        f"total={total}, "
        f"updated={updated}, "
        f"text_weight={TEXT_WEIGHT}, "
        f"rating_weight={RATING_WEIGHT}"
    )


if __name__ == "__main__":
    main()
