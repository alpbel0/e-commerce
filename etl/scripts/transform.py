from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from config import DatasetConfig, PAYMENT_METHOD_MAP, SATISFACTION_LEVEL_MAP, STATUS_MAP
from utils import clean_strings, normalize_boolean_column, normalize_columns


@dataclass(frozen=True)
class TransformResult:
    staging: pd.DataFrame
    rejects: pd.DataFrame
    summary: dict[str, int]


def _apply_base_transformations(dataset: DatasetConfig, frame: pd.DataFrame) -> pd.DataFrame:
    transformed = normalize_columns(frame, dataset.rename_map)
    transformed = clean_strings(transformed)
    transformed.insert(0, "source_system", dataset.source_system)
    transformed.insert(1, "source_row_number", range(1, len(transformed) + 1))

    for column_name in dataset.date_columns:
        transformed[column_name] = pd.to_datetime(transformed[column_name], errors="coerce")

    for column_name in dataset.numeric_columns:
        transformed[column_name] = pd.to_numeric(transformed[column_name], errors="coerce")

    for column_name in dataset.integer_columns:
        transformed[column_name] = transformed[column_name].astype("Int64")

    for column_name in dataset.identifier_columns:
        transformed[column_name] = transformed[column_name].map(
            lambda value: str(value).strip() if pd.notna(value) else pd.NA
        ).astype("string")

    return transformed


def _transform_amazon(frame: pd.DataFrame) -> pd.DataFrame:
    transformed = frame.copy()
    transformed["order_status"] = transformed["order_status"].map(
        lambda value: STATUS_MAP.get(str(value).strip().lower(), str(value).strip().upper()) if pd.notna(value) else pd.NA
    )
    transformed["payment_method"] = transformed["payment_method"].map(
        lambda value: PAYMENT_METHOD_MAP.get(str(value).strip().lower(), str(value).strip().upper()) if pd.notna(value) else pd.NA
    )
    return transformed


def _transform_customer_behavior(frame: pd.DataFrame) -> pd.DataFrame:
    transformed = frame.copy()
    transformed["satisfaction_level"] = transformed["satisfaction_level_raw"].map(
        lambda value: SATISFACTION_LEVEL_MAP.get(str(value).strip().lower(), pd.NA)
        if pd.notna(value)
        else pd.NA
    ).astype("Int64")
    transformed["discount_applied_flag"] = normalize_boolean_column(transformed["discount_applied"])
    return transformed


def _transform_online_retail(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    transformed = frame.copy()
    transformed["category_name"] = "UNCATEGORIZED"
    transformed["customer_id"] = transformed["customer_id"].map(
        lambda value: str(value).replace(".0", "").strip() if pd.notna(value) else pd.NA
    ).astype("string")

    rejected_mask = transformed["customer_id"].isna()
    rejects = transformed.loc[rejected_mask].copy()
    if not rejects.empty:
        rejects["reject_reason"] = "MISSING_CUSTOMER_ID"

    filtered = transformed.loc[~rejected_mask].copy()
    return filtered, rejects


def transform_dataset(dataset: DatasetConfig, frame: pd.DataFrame) -> TransformResult:
    transformed = _apply_base_transformations(dataset, frame)
    rejects = pd.DataFrame(columns=list(transformed.columns) + ["reject_reason"])

    if dataset.source_system == "AMAZON":
        transformed = _transform_amazon(transformed)
    elif dataset.source_system == "CUSTOMER_BEHAVIOR":
        transformed = _transform_customer_behavior(transformed)
    elif dataset.source_system == "ONLINE_RETAIL":
        transformed, rejects = _transform_online_retail(transformed)

    transformed = transformed.drop_duplicates().reset_index(drop=True)
    summary = {
        "raw_rows": len(frame),
        "staging_rows": len(transformed),
        "reject_rows": len(rejects),
    }
    return TransformResult(staging=transformed, rejects=rejects, summary=summary)

