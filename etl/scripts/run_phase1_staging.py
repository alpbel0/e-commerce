from __future__ import annotations

from pathlib import Path

from config import LOG_DIR, PHASE_1_DATASETS, STAGING_DIR
from extract import read_raw_dataset
from load import write_reject_dataset, write_staging_dataset
from transform import transform_dataset
from utils import append_run_log, ensure_directory


def main() -> None:
    ensure_directory(STAGING_DIR)
    ensure_directory(LOG_DIR)

    run_messages: list[str] = ["phase=1", "step=staging"]
    print("Starting Phase 1 ETL staging run...")

    for dataset in PHASE_1_DATASETS:
        raw_frame = read_raw_dataset(dataset)
        result = transform_dataset(dataset, raw_frame)

        staging_path = STAGING_DIR / dataset.output_filename
        reject_path = LOG_DIR / dataset.reject_filename

        write_staging_dataset(result.staging, staging_path)
        write_reject_dataset(result.rejects, reject_path)

        dataset_summary = (
            f"{dataset.source_system}: raw={result.summary['raw_rows']}, "
            f"staging={result.summary['staging_rows']}, rejects={result.summary['reject_rows']}"
        )
        print(dataset_summary)
        run_messages.append(dataset_summary)

    log_path = append_run_log(run_messages)
    print(f"Run log written to {log_path}")


if __name__ == "__main__":
    main()
