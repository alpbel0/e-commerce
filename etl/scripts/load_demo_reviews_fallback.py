from __future__ import annotations

from dataclasses import dataclass
import random
from uuid import uuid5

import pandas as pd

from config import LOG_DIR, UUID_NAMESPACE
from db import get_connection
from utils import append_run_log, ensure_directory


DEMO_REVIEW_LIMIT = 50_000
DEMO_REVIEW_ASSIGNMENT_SEED = 20260411


@dataclass(frozen=True)
class DemoFallbackSummary:
    selected_rejects: int
    loaded_reviews: int
    distinct_products_used: int
    distinct_orders_used: int


def _deterministic_id(entity_type: str, source_key: str) -> str:
    return str(uuid5(UUID_NAMESPACE, f"{entity_type}:{source_key}"))


def _load_reject_reviews() -> pd.DataFrame:
    reject_reviews = pd.read_csv(LOG_DIR / "amazon_reviews_rejects.csv", nrows=DEMO_REVIEW_LIMIT, dtype=str)
    if reject_reviews.empty:
        return reject_reviews

    numeric_columns = ("star_rating", "helpful_votes", "total_votes")
    for column in numeric_columns:
        if column in reject_reviews.columns:
            reject_reviews[column] = pd.to_numeric(reject_reviews[column], errors="coerce")

    reject_reviews["verified_purchase"] = (
        reject_reviews["verified_purchase"]
        .fillna("False")
        .astype(str)
        .str.strip()
        .str.lower()
        .map({"true": True, "false": False, "y": True, "n": False, "1": True, "0": False})
        .fillna(False)
    )
    return reject_reviews


def _fetch_products_and_orders() -> tuple[list[str], list[tuple[str, str | None]]]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id::text FROM products ORDER BY id")
            product_ids = [row[0] for row in cursor.fetchall()]

            cursor.execute("SELECT id::text, user_id::text FROM orders ORDER BY id")
            orders = [(row[0], row[1]) for row in cursor.fetchall()]

    return product_ids, orders


def _build_fallback_rows(reject_reviews: pd.DataFrame, product_ids: list[str], orders: list[tuple[str, str | None]]) -> list[tuple]:
    product_pool = product_ids.copy()
    order_pool = orders.copy()

    rng = random.Random(DEMO_REVIEW_ASSIGNMENT_SEED)
    rng.shuffle(product_pool)
    rng.shuffle(order_pool)

    rows: list[tuple] = []
    for index, row in enumerate(reject_reviews.itertuples(index=False)):
        product_id = product_pool[index % len(product_pool)]
        order_id, user_id = order_pool[index % len(order_pool)]
        review_id = _deterministic_id("review_demo_fallback", str(row.review_id))

        rows.append(
            (
                review_id,
                user_id,
                product_id,
                order_id,
                int(row.star_rating) if pd.notna(row.star_rating) else 5,
                row.review_headline if pd.notna(row.review_headline) else None,
                row.review_body if pd.notna(row.review_body) else None,
                bool(row.verified_purchase),
                row.review_date if pd.notna(row.review_date) else None,
                row.review_date if pd.notna(row.review_date) else None,
            )
        )

    return rows


def load_demo_reviews_fallback() -> DemoFallbackSummary:
    ensure_directory(LOG_DIR)

    reject_reviews = _load_reject_reviews()
    if reject_reviews.empty:
        return DemoFallbackSummary(
            selected_rejects=0,
            loaded_reviews=0,
            distinct_products_used=0,
            distinct_orders_used=0,
        )

    product_ids, orders = _fetch_products_and_orders()
    if not product_ids or not orders:
        raise RuntimeError("Demo review fallback requires loaded products and orders.")

    fallback_rows = _build_fallback_rows(reject_reviews, product_ids, orders)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO reviews (
                    id, user_id, product_id, order_id, star_rating,
                    review_title, review_text, verified_purchase, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                fallback_rows,
            )

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM reviews
                WHERE id = ANY(%s)
                """,
                ([row[0] for row in fallback_rows],),
            )
            loaded_reviews = cursor.fetchone()[0]

    summary = DemoFallbackSummary(
        selected_rejects=len(reject_reviews),
        loaded_reviews=loaded_reviews,
        distinct_products_used=len({row[2] for row in fallback_rows}),
        distinct_orders_used=len({row[3] for row in fallback_rows}),
    )
    append_run_log(
        [
            "phase=4",
            "step=load_demo_reviews_fallback",
            f"selected_rejects={summary.selected_rejects}",
            f"loaded_reviews={summary.loaded_reviews}",
            f"distinct_products_used={summary.distinct_products_used}",
            f"distinct_orders_used={summary.distinct_orders_used}",
            f"seed={DEMO_REVIEW_ASSIGNMENT_SEED}",
        ]
    )
    return summary


def main() -> None:
    summary = load_demo_reviews_fallback()
    print(
        "DEMO REVIEW FALLBACK: "
        f"selected_rejects={summary.selected_rejects}, "
        f"loaded_reviews={summary.loaded_reviews}, "
        f"distinct_products_used={summary.distinct_products_used}, "
        f"distinct_orders_used={summary.distinct_orders_used}, "
        f"seed={DEMO_REVIEW_ASSIGNMENT_SEED}"
    )


if __name__ == "__main__":
    main()
