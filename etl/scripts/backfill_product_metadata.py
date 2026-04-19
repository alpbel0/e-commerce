from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

from db import get_connection


STAGING_DIR = Path(__file__).resolve().parents[1] / "staging"

STOPWORDS = {
    "and",
    "for",
    "with",
    "the",
    "from",
    "your",
    "you",
    "set",
    "kit",
    "pack",
    "new",
    "mini",
    "plus",
    "pro",
    "max",
    "ultra",
    "basic",
    "classic",
}

CURRENCY_COUNTRY_FALLBACK = {
    "PKR": "Pakistan",
    "GBP": "United Kingdom",
    "USD": "United States",
    "INR": "India",
    "TRY": "Turkey",
    "AUD": "Australia",
    "CAD": "Canada",
    "EUR": "Germany",
}


def _clean_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_tag(value: str) -> str | None:
    lowered = value.strip().lower()
    lowered = lowered.replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    lowered = re.sub(r"-{2,}", "-", lowered).strip("-")
    if not lowered or len(lowered) < 2:
        return None
    if lowered in STOPWORDS:
        return None
    return lowered


def _tokenize(value: str) -> list[str]:
    parts = re.findall(r"[A-Za-z0-9]+", value.lower())
    return [part for part in parts if len(part) >= 3 and part not in STOPWORDS]


def build_source_country_maps() -> tuple[dict[str, str], dict[str, str]]:
    amazon_map: dict[str, str] = {}
    online_map: dict[str, str] = {}

    amazon_path = STAGING_DIR / "amazon_staging.csv"
    if amazon_path.exists():
        amazon = pd.read_csv(amazon_path, usecols=["product_id", "country"])
        amazon = amazon.dropna(subset=["product_id", "country"])
        grouped = amazon.groupby("product_id")["country"].agg(lambda s: s.mode().iloc[0] if not s.mode().empty else s.iloc[0])
        amazon_map = {str(product_id): str(country).strip() for product_id, country in grouped.items() if str(country).strip()}

    online_path = STAGING_DIR / "online_retail_staging.csv"
    if online_path.exists():
        online = pd.read_csv(online_path, usecols=["stock_code", "country"])
        online = online.dropna(subset=["stock_code", "country"])
        grouped = online.groupby("stock_code")["country"].agg(lambda s: s.mode().iloc[0] if not s.mode().empty else s.iloc[0])
        online_map = {str(stock_code): str(country).strip() for stock_code, country in grouped.items() if str(country).strip()}

    return amazon_map, online_map


def backfill_source_country(cur) -> None:
    amazon_map, online_map = build_source_country_maps()

    cur.execute(
        """
        SELECT p.id::text, p.currency, spm.source_system, spm.source_product_id
        FROM products p
        LEFT JOIN source_product_map spm ON spm.product_id = p.id
        WHERE p.source_country IS NULL OR btrim(p.source_country) = ''
        """
    )

    updates: list[tuple[str, str]] = []
    for product_id, currency, source_system, source_product_id in cur.fetchall():
        country = None
        if source_system == "PAKISTAN":
            country = "Pakistan"
        elif source_system == "AMAZON" and source_product_id:
            country = amazon_map.get(str(source_product_id))
        elif source_system == "ONLINE_RETAIL" and source_product_id:
            country = online_map.get(str(source_product_id))

        if not country:
            country = CURRENCY_COUNTRY_FALLBACK.get((currency or "").strip().upper())

        if country:
            updates.append((country, product_id))

    if updates:
        cur.executemany(
            """
            UPDATE products
            SET source_country = %s
            WHERE id = %s::uuid
            """,
            updates,
        )


def build_tags(title: str | None, category_name: str | None, brand: str | None) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()

    def add(tag: str | None) -> None:
        if not tag or tag in seen:
            return
        seen.add(tag)
        ordered.append(tag)

    if category_name:
        add(_normalize_tag(category_name))
        for token in _tokenize(category_name):
            add(_normalize_tag(token))

    if brand:
        add(_normalize_tag(brand))

    if title:
        for token in _tokenize(title):
            add(_normalize_tag(token))

    return ordered[:6]


def backfill_tags(cur) -> None:
    cur.execute(
        """
        SELECT p.id::text, p.title, p.brand, c.name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.tags IS NULL OR cardinality(p.tags) = 0
        """
    )
    updates: list[tuple[list[str], str]] = []
    for product_id, title, brand, category_name in cur.fetchall():
        tags = build_tags(_clean_text(title), _clean_text(category_name), _clean_text(brand))
        if tags:
            updates.append((tags, product_id))

    if updates:
        cur.executemany(
            """
            UPDATE products
            SET tags = %s
            WHERE id = %s::uuid
            """,
            updates,
        )


def print_summary(cur, label: str) -> None:
    cur.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE source_country IS NULL OR btrim(source_country)='') AS source_country_missing,
          COUNT(*) FILTER (WHERE tags IS NULL OR cardinality(tags)=0) AS tags_missing,
          COUNT(*) FILTER (WHERE description IS NULL OR btrim(description)='') AS description_missing,
          COUNT(*) FILTER (WHERE brand IS NULL OR btrim(brand)='') AS brand_missing,
          COUNT(*) FILTER (WHERE image_urls IS NULL OR cardinality(image_urls)=0) AS image_missing
        FROM products
        """
    )
    print(label, cur.fetchone())


def main() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            print_summary(cur, "before")
            backfill_source_country(cur)
            backfill_tags(cur)
            print_summary(cur, "after")


if __name__ == "__main__":
    main()
