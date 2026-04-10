from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from db import get_connection
from utils import append_run_log, ensure_directory


BASE_DIR = Path(__file__).resolve().parents[1]
VALIDATION_DIR = BASE_DIR / "processed" / "validation"


@dataclass(frozen=True)
class ValidationSummary:
    row_counts: dict[str, int]
    relationship_checks: dict[str, bool]
    metrics: dict[str, int]
    reject_counts: dict[str, int]


def _count_lines(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8") as handle:
        return max(sum(1 for _ in handle) - 1, 0)


def run_validation() -> ValidationSummary:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            row_counts: dict[str, int] = {}
            for table in [
                "users",
                "customer_profiles",
                "stores",
                "categories",
                "products",
                "source_product_map",
                "orders",
                "source_order_map",
                "order_items",
                "shipments",
                "reviews",
            ]:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                row_counts[table] = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM users u
                JOIN customer_profiles cp ON cp.user_id = u.id
                """
            )
            users_with_profiles = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(DISTINCT o.id)
                FROM orders o
                JOIN order_items oi ON oi.order_id = o.id
                """
            )
            orders_with_items = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(DISTINCT p.id)
                FROM products p
                JOIN reviews r ON r.product_id = p.id
                """
            )
            products_with_reviews = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(DISTINCT o.id)
                FROM orders o
                JOIN shipments s ON s.order_id = o.id
                """
            )
            orders_with_shipments = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM orders o
                LEFT JOIN users u ON u.id = o.user_id
                LEFT JOIN stores s ON s.id = o.store_id
                WHERE u.id IS NULL OR s.id IS NULL
                """
            )
            broken_order_refs = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM order_items oi
                LEFT JOIN orders o ON o.id = oi.order_id
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE o.id IS NULL OR p.id IS NULL
                """
            )
            broken_order_item_refs = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM reviews r
                LEFT JOIN products p ON p.id = r.product_id
                WHERE p.id IS NULL
                """
            )
            broken_review_refs = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM shipments s
                LEFT JOIN orders o ON o.id = s.order_id
                WHERE o.id IS NULL
                """
            )
            broken_shipment_refs = cursor.fetchone()[0]

    metrics = {
        "users_with_profiles": users_with_profiles,
        "orders_with_items": orders_with_items,
        "products_with_reviews": products_with_reviews,
        "orders_with_shipments": orders_with_shipments,
        "broken_order_refs": broken_order_refs,
        "broken_order_item_refs": broken_order_item_refs,
        "broken_review_refs": broken_review_refs,
        "broken_shipment_refs": broken_shipment_refs,
    }

    relationship_checks = {
        "users_to_customer_profiles": users_with_profiles > 0 and broken_order_refs == 0,
        "orders_to_order_items": orders_with_items == row_counts["orders"] and broken_order_item_refs == 0,
        "products_to_reviews": broken_review_refs == 0,
        "orders_to_shipments": broken_shipment_refs == 0,
        "sample_order_joins": broken_order_refs == 0,
    }

    reject_counts = {
        "amazon_reviews_rejects": _count_lines(BASE_DIR / "logs" / "amazon_reviews_rejects.csv"),
        "online_retail_rejects": _count_lines(BASE_DIR / "logs" / "online_retail_rejects.csv"),
        "train_rejects": _count_lines(BASE_DIR / "logs" / "train_rejects.csv"),
    }

    return ValidationSummary(
        row_counts=row_counts,
        relationship_checks=relationship_checks,
        metrics=metrics,
        reject_counts=reject_counts,
    )


def write_report(summary: ValidationSummary) -> tuple[Path, Path]:
    ensure_directory(VALIDATION_DIR)

    json_path = VALIDATION_DIR / "week4_validation_report.json"
    markdown_path = VALIDATION_DIR / "week4_validation_report.md"

    json_path.write_text(json.dumps(asdict(summary), indent=2), encoding="utf-8")

    markdown = "\n".join(
        [
            "# Week 4 Validation Report",
            "",
            "## Row Counts",
            *[f"- `{table}`: `{count}`" for table, count in summary.row_counts.items()],
            "",
            "## Relationship Checks",
            *[f"- `{name}`: `{status}`" for name, status in summary.relationship_checks.items()],
            "",
            "## Metrics",
            *[f"- `{name}`: `{value}`" for name, value in summary.metrics.items()],
            "",
            "## Reject Counts",
            *[f"- `{name}`: `{value}`" for name, value in summary.reject_counts.items()],
        ]
    )
    markdown_path.write_text(markdown, encoding="utf-8")
    return json_path, markdown_path


def main() -> None:
    summary = run_validation()
    json_path, markdown_path = write_report(summary)
    append_run_log(
        [
            "phase=4",
            "step=validate_core_load",
            f"report_json={json_path.name}",
            f"report_md={markdown_path.name}",
        ]
    )
    print(f"VALIDATION REPORT: json={json_path.name}, md={markdown_path.name}")
    print(json.dumps(asdict(summary), indent=2))


if __name__ == "__main__":
    main()
