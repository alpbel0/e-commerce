from __future__ import annotations

import json
from pathlib import Path

from db import get_connection
from utils import append_run_log, ensure_directory


BASE_DIR = Path(__file__).resolve().parents[1]
VALIDATION_DIR = BASE_DIR / "processed" / "validation"


QUERIES = {
    "top_seller_products": """
        SELECT p.title, SUM(oi.quantity) AS total_units
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        GROUP BY p.title
        ORDER BY total_units DESC
        LIMIT 5
    """,
    "top_customer_spend": """
        SELECT u.email, ROUND(CAST(SUM(o.grand_total) AS numeric), 2) AS total_spend
        FROM orders o
        JOIN users u ON u.id = o.user_id
        GROUP BY u.email
        ORDER BY total_spend DESC
        LIMIT 5
    """,
    "store_order_revenue": """
        SELECT s.name, COUNT(o.id) AS order_count, ROUND(CAST(SUM(o.grand_total) AS numeric), 2) AS revenue
        FROM stores s
        JOIN orders o ON o.store_id = s.id
        GROUP BY s.name
        ORDER BY revenue DESC
        LIMIT 5
    """,
    "category_product_distribution": """
        SELECT c.name, COUNT(p.id) AS product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.name
        ORDER BY product_count DESC, c.name
    """,
    "review_average_scores": """
        SELECT p.title, ROUND(CAST(AVG(r.star_rating) AS numeric), 2) AS avg_rating, COUNT(r.id) AS review_count
        FROM reviews r
        JOIN products p ON p.id = r.product_id
        GROUP BY p.title
        ORDER BY review_count DESC, avg_rating DESC
        LIMIT 5
    """,
}


def run_queries() -> dict[str, list[dict[str, object]]]:
    results: dict[str, list[dict[str, object]]] = {}
    with get_connection() as connection:
        with connection.cursor() as cursor:
            for name, sql in QUERIES.items():
                cursor.execute(sql)
                columns = [column.name for column in cursor.description]
                rows = cursor.fetchall()
                results[name] = [dict(zip(columns, row, strict=False)) for row in rows]
    return results


def write_report(results: dict[str, list[dict[str, object]]]) -> tuple[Path, Path]:
    ensure_directory(VALIDATION_DIR)
    json_path = VALIDATION_DIR / "week4_analytics_report.json"
    md_path = VALIDATION_DIR / "week4_analytics_report.md"

    json_path.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")

    lines = ["# Week 4 Analytics Verification", ""]
    for name, rows in results.items():
        lines.append(f"## {name}")
        if not rows:
            lines.append("- No rows returned")
        else:
            for row in rows:
                formatted = ", ".join(f"`{key}`={value}" for key, value in row.items())
                lines.append(f"- {formatted}")
        lines.append("")

    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path


def main() -> None:
    results = run_queries()
    json_path, md_path = write_report(results)
    append_run_log(
        [
            "phase=4",
            "step=verify_analytics_ready",
            f"report_json={json_path.name}",
            f"report_md={md_path.name}",
        ]
    )
    print(f"ANALYTICS REPORT: json={json_path.name}, md={md_path.name}")
    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()
