from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid5

import pandas as pd

from config import MAPPINGS_DIR, PHASE_1_DATASETS, STAGING_DIR, UUID_NAMESPACE
from utils import ensure_directory


@dataclass(frozen=True)
class MappingResult:
    source_customer_map: pd.DataFrame
    source_product_map: pd.DataFrame
    source_order_map: pd.DataFrame
    summary: dict[str, int]


def _deterministic_id(entity_type: str, source_system: str, source_id: str) -> str:
    return str(uuid5(UUID_NAMESPACE, f"{entity_type}:{source_system}:{source_id}"))


def _read_staging_frame(filename: str) -> pd.DataFrame:
    path = STAGING_DIR / filename
    return pd.read_csv(path)


def _build_customer_map(frames: list[pd.DataFrame]) -> pd.DataFrame:
    customer_frames = []
    for frame in frames:
        if "customer_id" not in frame.columns:
            continue
        scoped = frame[["source_system", "customer_id"]].copy()
        scoped = scoped.rename(columns={"customer_id": "source_customer_id"})
        customer_frames.append(scoped)

    combined = pd.concat(customer_frames, ignore_index=True)
    combined = combined.dropna(subset=["source_customer_id"]).drop_duplicates()
    combined["source_customer_id"] = combined["source_customer_id"].astype(str)
    combined["user_id"] = combined.apply(
        lambda row: _deterministic_id("user", row["source_system"], row["source_customer_id"]),
        axis=1,
    )
    return combined.sort_values(["source_system", "source_customer_id"]).reset_index(drop=True)


def _build_product_map(frames: list[pd.DataFrame]) -> pd.DataFrame:
    product_frames = []
    for frame in frames:
        if "product_id" in frame.columns:
            scoped = frame[["source_system", "product_id"]].copy()
            scoped = scoped.rename(columns={"product_id": "source_product_id"})
        elif "stock_code" in frame.columns:
            scoped = frame[["source_system", "stock_code"]].copy()
            scoped = scoped.rename(columns={"stock_code": "source_product_id"})
        else:
            continue
        product_frames.append(scoped)

    combined = pd.concat(product_frames, ignore_index=True)
    combined = combined.dropna(subset=["source_product_id"]).drop_duplicates()
    combined["source_product_id"] = combined["source_product_id"].astype(str)
    combined["product_id"] = combined.apply(
        lambda row: _deterministic_id("product", row["source_system"], row["source_product_id"]),
        axis=1,
    )
    return combined.sort_values(["source_system", "source_product_id"]).reset_index(drop=True)


def _build_order_map(frames: list[pd.DataFrame]) -> pd.DataFrame:
    order_frames = []
    for frame in frames:
        if "order_id" in frame.columns:
            scoped = frame[["source_system", "order_id"]].copy()
            scoped = scoped.rename(columns={"order_id": "source_order_id"})
        elif "invoice_no" in frame.columns:
            scoped = frame[["source_system", "invoice_no"]].copy()
            scoped = scoped.rename(columns={"invoice_no": "source_order_id"})
        else:
            continue
        order_frames.append(scoped)

    combined = pd.concat(order_frames, ignore_index=True)
    combined = combined.dropna(subset=["source_order_id"]).drop_duplicates()
    combined["source_order_id"] = combined["source_order_id"].astype(str)
    combined["order_id"] = combined.apply(
        lambda row: _deterministic_id("order", row["source_system"], row["source_order_id"]),
        axis=1,
    )
    return combined.sort_values(["source_system", "source_order_id"]).reset_index(drop=True)


def build_phase_1_mappings() -> MappingResult:
    staging_frames = [_read_staging_frame(dataset.output_filename) for dataset in PHASE_1_DATASETS]

    source_customer_map = _build_customer_map(staging_frames)
    source_product_map = _build_product_map(staging_frames)
    source_order_map = _build_order_map(staging_frames)

    return MappingResult(
        source_customer_map=source_customer_map,
        source_product_map=source_product_map,
        source_order_map=source_order_map,
        summary={
            "customer_map_rows": len(source_customer_map),
            "product_map_rows": len(source_product_map),
            "order_map_rows": len(source_order_map),
        },
    )


def write_mappings(result: MappingResult) -> None:
    ensure_directory(MAPPINGS_DIR)
    result.source_customer_map.to_csv(MAPPINGS_DIR / "source_customer_map.csv", index=False)
    result.source_product_map.to_csv(MAPPINGS_DIR / "source_product_map.csv", index=False)
    result.source_order_map.to_csv(MAPPINGS_DIR / "source_order_map.csv", index=False)

