from __future__ import annotations

import pandas as pd

from config import DatasetConfig, RAW_DIR


def read_raw_dataset(dataset: DatasetConfig) -> pd.DataFrame:
    input_path = RAW_DIR / dataset.input_filename
    if dataset.reader == "csv":
        return pd.read_csv(input_path)
    if dataset.reader == "excel":
        return pd.read_excel(input_path, engine="openpyxl")
    raise ValueError(f"Unsupported reader type: {dataset.reader}")

