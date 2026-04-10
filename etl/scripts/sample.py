from __future__ import annotations

import json
from pathlib import Path

from config import SAMPLES_DIR
from utils import ensure_directory


def write_sample_summary(filename: str, payload: dict[str, object]) -> Path:
    ensure_directory(SAMPLES_DIR)
    path = SAMPLES_DIR / filename
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path

