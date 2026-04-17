from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from etl.scripts.db import get_connection
from etl.scripts.utils import append_run_log

ANALYZER = SentimentIntensityAnalyzer()

BATCH_SIZE = 500


def main() -> None:
    print("Fetching all reviews...")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, review_text FROM reviews WHERE review_text IS NOT NULL AND review_text != ''")
            rows = cur.fetchall()

    total = len(rows)
    print(f"Total: {total} reviews to score with VADER")

    updated = 0

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        updates: list[tuple] = []

        for review_id, text in batch:
            scores = ANALYZER.polarity_scores(text)
            compound = scores["compound"]
            updates.append((compound, review_id))

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    "UPDATE reviews SET text_score = %s WHERE id = %s",
                    updates,
                )

        updated += len(updates)
        processed = min(i + BATCH_SIZE, total)
        print(f"  Progress: {processed}/{total} ({updated} updated)")

    print(f"\nDONE: {updated}/{total} reviews updated with VADER compound scores")
    append_run_log([
        f"phase=5",
        f"step=backfill_review_text_score_vader",
        f"total={total}",
        f"updated={updated}",
    ])


if __name__ == "__main__":
    main()
