from __future__ import annotations

import argparse

import pandas as pd

from config import AMAZON_REVIEWS_DATASET, AMAZON_REVIEWS_SAMPLE_LIMIT, LOG_DIR, MAPPINGS_DIR, RAW_DIR, STAGING_DIR
from load import write_reject_dataset, write_staging_dataset
from sample import write_sample_summary
from transform import transform_dataset
from utils import append_run_log, ensure_directory


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--limit",
        type=int,
        default=AMAZON_REVIEWS_SAMPLE_LIMIT,
        help="Maximum number of review rows to process.",
    )
    parser.add_argument("--chunk-size", type=int, default=50000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_directory(STAGING_DIR)
    ensure_directory(LOG_DIR)

    product_map = pd.read_csv(MAPPINGS_DIR / "source_product_map.csv", dtype=str)
    exact_product_lookup = product_map.set_index("source_product_id")["product_id"].to_dict()

    staging_batches: list[pd.DataFrame] = []
    reject_batches: list[pd.DataFrame] = []
    review_map_batches: list[pd.DataFrame] = []

    processed_rows = 0
    matched_rows = 0
    rejected_rows = 0

    reader = pd.read_csv(
        RAW_DIR / AMAZON_REVIEWS_DATASET.input_filename,
        chunksize=args.chunk_size,
    )

    for chunk in reader:
        if args.limit is not None and processed_rows >= args.limit:
            break

        if args.limit is not None:
            remaining = args.limit - processed_rows
            chunk = chunk.head(remaining)

        transformed = transform_dataset(AMAZON_REVIEWS_DATASET, chunk)
        frame = transformed.staging
        frame["product_id"] = frame["product_id"].astype("string")
        frame["mapped_product_id"] = frame["product_id"].map(exact_product_lookup)
        frame["verified_purchase"] = frame["verified_purchase"].map(
            lambda value: str(value).strip().lower() == "y" if pd.notna(value) else pd.NA
        ).astype("boolean")

        matched = frame.loc[frame["mapped_product_id"].notna()].copy()
        if not matched.empty:
            matched = matched.rename(columns={"mapped_product_id": "unified_product_id"})
            staging_batches.append(matched)
            review_map_batches.append(
                matched[["source_system", "product_id", "unified_product_id"]]
                .rename(columns={"product_id": "source_product_id", "unified_product_id": "product_id"})
                .drop_duplicates()
            )

        rejects = frame.loc[frame["mapped_product_id"].isna()].copy()
        if not rejects.empty:
            rejects["reject_reason"] = "NO_EXACT_SOURCE_PRODUCT_MATCH"
            reject_batches.append(rejects.drop(columns=["mapped_product_id"]))

        processed_rows += len(frame)
        matched_rows += len(matched)
        rejected_rows += len(rejects)

    staging_columns = [
        "source_system",
        "source_row_number",
        "customer_id",
        "review_id",
        "product_id",
        "product_parent",
        "product_title",
        "product_category",
        "star_rating",
        "helpful_votes",
        "total_votes",
        "vine",
        "verified_purchase",
        "review_headline",
        "review_body",
        "review_date",
        "unified_product_id",
    ]
    reject_columns = [
        "source_system",
        "source_row_number",
        "customer_id",
        "review_id",
        "product_id",
        "product_parent",
        "product_title",
        "product_category",
        "star_rating",
        "helpful_votes",
        "total_votes",
        "vine",
        "verified_purchase",
        "review_headline",
        "review_body",
        "review_date",
        "reject_reason",
    ]

    staging_frame = pd.concat(staging_batches, ignore_index=True) if staging_batches else pd.DataFrame(columns=staging_columns)
    reject_frame = pd.concat(reject_batches, ignore_index=True) if reject_batches else pd.DataFrame(columns=reject_columns)
    review_map_frame = pd.concat(review_map_batches, ignore_index=True).drop_duplicates() if review_map_batches else pd.DataFrame(
        columns=["source_system", "source_product_id", "product_id"]
    )

    write_staging_dataset(staging_frame, STAGING_DIR / AMAZON_REVIEWS_DATASET.output_filename)
    write_reject_dataset(reject_frame, LOG_DIR / AMAZON_REVIEWS_DATASET.reject_filename)
    write_staging_dataset(review_map_frame, MAPPINGS_DIR / "source_product_map_amazon_reviews.csv")
    summary_path = write_sample_summary(
        "amazon_reviews_sample_summary.json",
        {
            "dataset": "AMAZON_REVIEWS",
            "strategy": "head_chunked_exact_match",
            "row_limit": args.limit,
            "processed_rows": processed_rows,
            "matched_rows": matched_rows,
            "rejected_rows": rejected_rows,
            "chunk_size": args.chunk_size,
            "exact_match_only": True,
        },
    )

    summary = (
        f"AMAZON_REVIEWS: processed={processed_rows}, matched={matched_rows}, "
        f"rejects={rejected_rows}, exact_match_only=true, row_limit={args.limit or 'ALL'}"
    )
    print(summary)
    print(f"Sample summary written to {summary_path}")
    append_run_log(["phase=3", "step=amazon_reviews_exact_match", summary])


if __name__ == "__main__":
    main()
