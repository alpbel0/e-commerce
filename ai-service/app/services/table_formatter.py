"""Table formatting utilities for chat responses."""

import re
from typing import Any, Dict, List, Optional, Set

from app.schemas.chat import TableResponse
from app.services.pii_policy import pii_policy


# === Column type detection ===

DATETIME_TYPES: Set[str] = {"DATE", "TIMESTAMP", "TIME", "DATETIME", "TIMESTAMPTZ"}
CURRENCY_TYPES: Set[str] = {"DECIMAL", "NUMERIC", "MONEY", "REAL", "DOUBLE", "FLOAT8", "FLOAT4"}
LONG_TEXT_TYPES: Set[str] = {"TEXT", "CLOB", "BPCHAR"}

DATETIME_COLUMN_NAMES: Set[str] = {
    "created_at", "updated_at", "deleted_at", "order_date", "shipped_at",
    "delivered_at", "estimated_delivery_date", "actual_delivery_date",
    "paid_at", "confirmed_at", "cancelled_at", "returned_at",
    "review_date", "created", "updated", "date", "time",
}
CURRENCY_COLUMN_NAMES: Set[str] = {
    "unit_price", "discount_amount", "subtotal", "grand_total", "tax_amount",
    "shipping_fee", "total_amount", "price", "cost", "revenue", "total",
    "amount", "fee", "total_sales", "discount_applied", "unit_price_at_purchase",
}
NON_CURRENCY_NUMERIC_COLUMN_NAMES: Set[str] = {
    "avg_rating", "average_rating", "rating", "score", "sentiment_score",
    "review_count", "count", "order_count", "total_orders", "quantity", "qty",
}
EXPLICIT_CURRENCY_COLUMN_NAMES: Set[str] = {
    "currency", "currency_code", "order_currency", "store_currency", "product_currency",
    "payment_currency", "base_currency", "quote_currency",
}
LONG_TEXT_COLUMN_NAMES: Set[str] = {
    "description", "notes", "review_text", "address", "text", "content",
    "review_title", "return_reason", "order_notes", "shipping_address",
    "product_description", "store_description", "category_description",
}


def _is_datetime_column(col_name: str, data_type: str) -> bool:
    normalized_type = data_type.upper().split("(", 1)[0]
    if normalized_type in DATETIME_TYPES:
        return True
    col_lower = col_name.lower()
    return any(
        col_lower.endswith(suffix) or col_lower == suffix
        for suffix in ["_date", "_at", "_time", "created", "updated", "date"]
    )


def _is_currency_column(col_name: str, data_type: str) -> bool:
    col_lower = col_name.lower()
    if col_lower in NON_CURRENCY_NUMERIC_COLUMN_NAMES:
        return False
    normalized_type = data_type.upper().split("(", 1)[0]
    if normalized_type in CURRENCY_TYPES:
        return True
    return any(
        col_lower.endswith(suffix) or col_lower == suffix
        for suffix in ["_price", "_amount", "_total", "_fee", "_cost"]
    )


def _is_long_text_column(col_name: str, data_type: str) -> bool:
    normalized_type = data_type.upper().split("(", 1)[0]
    if normalized_type in LONG_TEXT_TYPES:
        return True
    if data_type.upper().startswith("VARCHAR"):
        match = re.search(r"VARCHAR\((\d+)\)", data_type.upper())
        if match and int(match.group(1)) > 100:
            return True
    return col_name.lower() in LONG_TEXT_COLUMN_NAMES


# === Value formatting ===

def _format_currency(value: Any) -> str:
    """Format a numeric amount without inventing a currency."""
    if value is None:
        return "-"
    try:
        return f"{float(value):,.2f}"
    except (ValueError, TypeError):
        return str(value) if value is not None else "-"


def _format_datetime(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, str):
        s = value.strip()
        if len(s) > 16:
            return s[:16]
        return s
    return str(value)


def _format_long_text(value: Any, limit: int = 80) -> str:
    if value is None:
        return "-"
    s = str(value)
    if len(s) > limit:
        return s[:limit].rstrip() + "..."
    return s


def _format_generic(value: Any) -> str:
    if value is None:
        return "-"
    return str(value)


def _normalize_currency_code(value: Any) -> Optional[str]:
    if value is None:
        return None
    code = str(value).strip().upper()
    if re.fullmatch(r"[A-Z]{3}", code):
        return code
    if code == "MIXED":
        return code
    return None


def _resolve_row_currency(columns: list[str], row: list[Any], value_column: str) -> Optional[str]:
    row_map = {col: row[idx] for idx, col in enumerate(columns) if idx < len(row)}
    normalized = {col.lower(): _normalize_currency_code(value) for col, value in row_map.items()}

    value_col_lower = value_column.lower()
    prefix = value_col_lower
    for suffix in ("_amount", "_price", "_revenue", "_total", "_fee", "_cost", "_sales"):
        if value_col_lower.endswith(suffix):
            prefix = value_col_lower[: -len(suffix)]
            break

    candidate_keys: list[str] = []
    if prefix:
        candidate_keys.extend([f"{prefix}_currency", f"{prefix}_currency_code"])
    candidate_keys.extend(["currency", "currency_code"])

    for key in candidate_keys:
        code = normalized.get(key)
        if code:
            return code

    fallback_candidates: list[str] = []
    for col_name, code in normalized.items():
        if col_name in EXPLICIT_CURRENCY_COLUMN_NAMES and code:
            fallback_candidates.append(code)

    unique = sorted(set(fallback_candidates))
    if len(unique) == 1:
        return unique[0]
    return None


def _format_currency_with_code(value: Any, currency_code: Optional[str]) -> str:
    formatted = _format_currency(value)
    if formatted == "-" or not currency_code:
        return formatted
    return f"{formatted} {currency_code}"


# === Column label mapping ===

def _to_label(col_name: str) -> str:
    specials = {
        "id": "ID",
        "uuid": "UUID",
        "url": "URL",
        "api": "API",
        "sku": "SKU",
    }
    col_lower = col_name.lower()
    if col_lower in specials:
        return specials[col_lower]
    return col_name.replace("_", " ").title()


# === Main formatting function ===

def format_table_response(
    query_result: Dict[str, Any],
    column_metadata: List[Dict[str, Any]],
    language: str,
    sql_max_rows: int,
) -> TableResponse:
    columns: list[str] = query_result.get("columns", [])
    rows: list[list] = query_result.get("rows", [])

    if not columns:
        return TableResponse(columns=[], rows=[], row_count=0, truncated=False)

    meta_by_name: Dict[str, dict] = {m["name"]: m for m in column_metadata}

    safe_columns: list[str] = []
    safe_indices: list[int] = []
    for i, col in enumerate(columns):
        col_meta = meta_by_name.get(col, {})
        is_pii = col_meta.get("isPII", False) or pii_policy.is_sensitive_column(col)
        if is_pii:
            continue
        safe_columns.append(col)
        safe_indices.append(i)

    filtered_rows: list[list] = []
    for row in rows:
        filtered_rows.append([row[i] for i in safe_indices])

    formatted_columns = [_to_label(col) for col in safe_columns]
    formatted_rows: list[list] = []
    for row in filtered_rows:
        formatted_row: list[str] = []
        for col, value in zip(safe_columns, row):
            col_meta = meta_by_name.get(col, {})
            data_type = col_meta.get("dataType", "VARCHAR")

            if _is_datetime_column(col, data_type):
                formatted_row.append(_format_datetime(value))
            elif _is_currency_column(col, data_type):
                currency_code = _resolve_row_currency(safe_columns, row, col)
                formatted_row.append(_format_currency_with_code(value, currency_code))
            elif _is_long_text_column(col, data_type):
                formatted_row.append(_format_long_text(value))
            else:
                formatted_row.append(_format_generic(value))
        formatted_rows.append(formatted_row)

    return TableResponse(
        columns=formatted_columns,
        rows=formatted_rows,
        row_count=len(formatted_rows),
        truncated=len(rows) >= sql_max_rows,
    )


def format_table_from_data(
    data: List[Dict[str, Any]],
    column_metadata: List[Dict[str, Any]],
    language: str,
    sql_max_rows: int,
) -> TableResponse:
    if not data:
        return TableResponse(columns=[], rows=[], row_count=0, truncated=False)

    columns = list(data[0].keys())
    rows = [[row.get(col) for col in columns] for row in data]
    return format_table_response(
        {"columns": columns, "rows": rows},
        column_metadata,
        language,
        sql_max_rows,
    )
