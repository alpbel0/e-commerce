from __future__ import annotations

from config import LOG_DIR
from mapping import build_phase_1_mappings, write_mappings
from utils import append_run_log, ensure_directory


def main() -> None:
    ensure_directory(LOG_DIR)
    result = build_phase_1_mappings()
    write_mappings(result)

    summary_line = (
        f"customers={result.summary['customer_map_rows']}, "
        f"products={result.summary['product_map_rows']}, "
        f"orders={result.summary['order_map_rows']}"
    )
    print(f"Phase 1 mapping build complete: {summary_line}")
    append_run_log(["phase=1", "step=mappings", summary_line])


if __name__ == "__main__":
    main()
