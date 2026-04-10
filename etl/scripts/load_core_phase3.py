from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid5

import pandas as pd

from config import LOG_DIR, MAPPINGS_DIR, STAGING_DIR, UUID_NAMESPACE
from db import get_connection
from utils import append_run_log, ensure_directory


TRAIN_SOURCE = "TRAIN"
AMAZON_REVIEWS_SOURCE = "AMAZON_REVIEWS"


@dataclass(frozen=True)
class LoadSummary:
    shipments: int
    shipment_assignment_coverage: int
    reviews: int
    review_rejects: int


def _deterministic_id(entity_type: str, source_key: str) -> str:
    return str(uuid5(UUID_NAMESPACE, f"{entity_type}:{source_key}"))


def _count_csv_rows(path) -> int:
    frame = pd.read_csv(path)
    return len(frame)


def _build_shipment_rows(existing_order_ids: set[str]) -> list[tuple]:
    shipments = pd.read_csv(
        STAGING_DIR / "train_shipments_staging.csv",
        dtype={"shipment_source_id": str, "assigned_order_id": str},
    )
    shipments = shipments.dropna(subset=["assigned_order_id"]).drop_duplicates(subset=["assigned_order_id"])
    shipments = shipments.loc[shipments["assigned_order_id"].isin(existing_order_ids)].copy()

    rows: list[tuple] = []
    for row in shipments.itertuples(index=False):
        rows.append(
            (
                _deterministic_id("shipment", f"{TRAIN_SOURCE}:{row.shipment_source_id}"),
                row.assigned_order_id,
                f"TRN-{str(row.shipment_source_id).zfill(8)}",
                row.mode_of_shipment if pd.notna(row.mode_of_shipment) else None,
                "TRAIN_ETL",
                row.shipment_status if pd.notna(row.shipment_status) else "PENDING",
            )
        )
    return rows


def _build_review_rows() -> list[tuple]:
    review_staging = pd.read_csv(
        STAGING_DIR / "amazon_reviews_staging.csv",
        dtype={"customer_id": str, "review_id": str, "product_id": str, "unified_product_id": str},
    )
    if review_staging.empty:
        return []

    source_customer_map = pd.read_csv(MAPPINGS_DIR / "source_customer_map.csv", dtype=str)
    amazon_review_customers = source_customer_map.loc[source_customer_map["source_system"] == AMAZON_REVIEWS_SOURCE].rename(
        columns={"source_customer_id": "customer_id"}
    )
    merged = review_staging.merge(amazon_review_customers, on=["source_system", "customer_id"], how="left")

    rows: list[tuple] = []
    for row in merged.itertuples(index=False):
        rows.append(
            (
                _deterministic_id("review", f"{AMAZON_REVIEWS_SOURCE}:{row.review_id}"),
                row.user_id if hasattr(row, "user_id") and pd.notna(row.user_id) else None,
                row.unified_product_id,
                None,
                int(row.star_rating),
                row.review_headline if pd.notna(row.review_headline) else None,
                row.review_body if pd.notna(row.review_body) else None,
                bool(row.verified_purchase) if pd.notna(row.verified_purchase) else False,
                row.review_date if pd.notna(row.review_date) else None,
                row.review_date if pd.notna(row.review_date) else None,
            )
        )
    return rows


def load_phase_3_shipments_and_reviews() -> LoadSummary:
    ensure_directory(LOG_DIR)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM orders")
            existing_order_ids = {str(row[0]) for row in cursor.fetchall()}

            shipment_rows = _build_shipment_rows(existing_order_ids)
            review_rows = _build_review_rows()
            review_rejects = _count_csv_rows(LOG_DIR / "amazon_reviews_rejects.csv")

            cursor.execute("TRUNCATE TABLE reviews, shipments RESTART IDENTITY CASCADE")

            cursor.executemany(
                """
                INSERT INTO shipments (
                    id, order_id, tracking_number, mode_of_shipment, carrier_name, status
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                shipment_rows,
            )

            if review_rows:
                cursor.executemany(
                    """
                    INSERT INTO reviews (
                        id, user_id, product_id, order_id, star_rating,
                        review_title, review_text, verified_purchase, created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    review_rows,
                )

    summary = LoadSummary(
        shipments=len(shipment_rows),
        shipment_assignment_coverage=len(shipment_rows),
        reviews=len(review_rows),
        review_rejects=review_rejects,
    )
    append_run_log(
        [
            "phase=4",
            "step=load_shipments_and_reviews",
            f"shipments={summary.shipments}",
            f"shipment_assignment_coverage={summary.shipment_assignment_coverage}",
            f"reviews={summary.reviews}",
            f"review_rejects={summary.review_rejects}",
        ]
    )
    return summary


def main() -> None:
    summary = load_phase_3_shipments_and_reviews()
    print(
        "PHASE 4 DOMAIN LOAD: "
        f"shipments={summary.shipments}, "
        f"shipment_assignment_coverage={summary.shipment_assignment_coverage}, "
        f"reviews={summary.reviews}, "
        f"review_rejects={summary.review_rejects}"
    )


if __name__ == "__main__":
    main()
