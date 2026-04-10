from __future__ import annotations

import random

import pandas as pd

from config import LOG_DIR, MAPPINGS_DIR, SHIPMENT_ASSIGNMENT_SEED, STAGING_DIR, TRAIN_DATASET
from extract import read_raw_dataset
from load import write_reject_dataset, write_staging_dataset
from transform import transform_dataset
from utils import append_run_log, ensure_directory


def main() -> None:
    ensure_directory(STAGING_DIR)
    ensure_directory(LOG_DIR)

    raw_frame = read_raw_dataset(TRAIN_DATASET)
    result = transform_dataset(TRAIN_DATASET, raw_frame)

    order_map = pd.read_csv(MAPPINGS_DIR / "source_order_map.csv")
    shuffled_orders = order_map[["source_order_id", "order_id"]].copy().to_dict(orient="records")
    random.Random(SHIPMENT_ASSIGNMENT_SEED).shuffle(shuffled_orders)

    assignment_count = min(len(result.staging), len(shuffled_orders))
    assigned_orders = pd.DataFrame(shuffled_orders[:assignment_count])

    shipments = result.staging.iloc[:assignment_count].copy().reset_index(drop=True)
    shipments["source_order_id"] = assigned_orders["source_order_id"]
    shipments["assigned_order_id"] = assigned_orders["order_id"]
    shipments["shipment_status"] = "DELIVERED"
    shipments["delivery_delay_flag"] = shipments["reached_on_time_flag"].map({1: True, 0: False}).astype("boolean")

    unassigned = result.staging.iloc[assignment_count:].copy()
    if not unassigned.empty:
        unassigned["reject_reason"] = "NO_AVAILABLE_ORDER_ASSIGNMENT"

    reject_frame = pd.concat([result.rejects, unassigned], ignore_index=True)

    write_staging_dataset(shipments, STAGING_DIR / TRAIN_DATASET.output_filename)
    write_reject_dataset(reject_frame, LOG_DIR / TRAIN_DATASET.reject_filename)

    summary = (
        f"TRAIN: raw={result.summary['raw_rows']}, staging={len(shipments)}, "
        f"rejects={len(reject_frame)}, assigned_orders={assignment_count}, seed={SHIPMENT_ASSIGNMENT_SEED}"
    )
    print(summary)
    append_run_log(["phase=3", "step=train_shipments", summary])


if __name__ == "__main__":
    main()

