from __future__ import annotations

import argparse

import pandas as pd

from config import PAKISTAN_DEV_SAMPLE_LIMIT, RAW_DIR, SAMPLES_DIR
from sample import write_sample_summary
from utils import ensure_directory


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=PAKISTAN_DEV_SAMPLE_LIMIT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_directory(SAMPLES_DIR)

    input_path = RAW_DIR / "Pakistan Largest Ecommerce Dataset.csv"
    sample_path = SAMPLES_DIR / "pakistan_dev_sample.csv"

    sample_frame = pd.read_csv(input_path, nrows=args.limit)
    sample_frame.to_csv(sample_path, index=False, encoding="utf-8")

    summary_path = write_sample_summary(
        "pakistan_dev_sample_summary.json",
        {
            "dataset": "PAKISTAN",
            "strategy": "head",
            "row_limit": args.limit,
            "sample_path": str(sample_path),
            "sample_rows": len(sample_frame),
        },
    )

    print(f"PAKISTAN sample created: rows={len(sample_frame)}, limit={args.limit}")
    print(f"Summary written to {summary_path}")


if __name__ == "__main__":
    main()

