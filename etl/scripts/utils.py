from __future__ import annotations

from datetime import datetime, UTC
from pathlib import Path
import re

import pandas as pd

from config import BOOLEAN_MAP, LOG_DIR


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def to_snake_case(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", value.strip())
    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", normalized)
    return normalized.strip("_").lower()


def normalize_columns(frame: pd.DataFrame, rename_map: dict[str, str]) -> pd.DataFrame:
    normalized_names = {}
    for original_name in frame.columns:
        normalized_names[original_name] = rename_map.get(original_name, to_snake_case(str(original_name)))
    return frame.rename(columns=normalized_names)


def clean_strings(frame: pd.DataFrame) -> pd.DataFrame:
    cleaned = frame.copy()
    for column_name in cleaned.columns:
        if pd.api.types.is_object_dtype(cleaned[column_name]) or pd.api.types.is_string_dtype(cleaned[column_name]):
            cleaned[column_name] = cleaned[column_name].map(
                lambda value: value.strip() if isinstance(value, str) else value
            )
            cleaned[column_name] = cleaned[column_name].replace("", pd.NA)
    return cleaned


def normalize_boolean_column(series: pd.Series) -> pd.Series:
    return series.map(
        lambda value: BOOLEAN_MAP.get(str(value).strip().lower(), pd.NA)
        if pd.notna(value)
        else pd.NA
    )


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    ensure_directory(path.parent)
    frame.to_csv(path, index=False, encoding="utf-8")


def append_run_log(lines: list[str]) -> Path:
    ensure_directory(LOG_DIR)
    log_path = LOG_DIR / "etl_run.log"
    timestamp = datetime.now(UTC).isoformat()
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {' | '.join(lines)}\n")
    return log_path

