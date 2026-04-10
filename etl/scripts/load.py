from __future__ import annotations

from pathlib import Path

import pandas as pd

from utils import write_csv


def write_staging_dataset(frame: pd.DataFrame, path: Path) -> None:
    write_csv(frame, path)


def write_reject_dataset(frame: pd.DataFrame, path: Path) -> None:
    write_csv(frame, path)

