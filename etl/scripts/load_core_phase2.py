from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import math
import re
from uuid import uuid5

import pandas as pd

from config import LOG_DIR, MAPPINGS_DIR, PAYMENT_METHOD_MAP, STAGING_DIR, STATUS_MAP, UUID_NAMESPACE
from db import get_connection
from load_core_phase1 import (
    ONLINE_RETAIL_STORE_NAME,
    PAKISTAN_STORE_NAME,
    SYSTEM_ADMIN_EMAIL,
    SYSTEM_ADMIN_PASSWORD_HASH,
    UNCATEGORIZED_SLUG,
)
from utils import append_run_log, ensure_directory


AMAZON_SOURCE = "AMAZON"
ONLINE_RETAIL_SOURCE = "ONLINE_RETAIL"
PAKISTAN_SOURCE = "PAKISTAN"
PAKISTAN_SYNTHETIC_SELLER_TARGET_ORDERS = 4_000

PAKISTAN_SYNTHETIC_SELLER_THEMES = {
    "Appliances": ("Appliance", ["Lahore", "Karachi", "Punjab", "Islamabad"], ["HomeMart", "Appliance Hub", "Kitchen Works", "Utility Store"]),
    "Beauty & Grooming": ("Beauty", ["Karachi", "Lahore", "Multan", "Islamabad"], ["Glow House", "Care Studio", "Beauty Mart", "Grooming Co"]),
    "Books": ("Book", ["Lahore", "Karachi", "Islamabad", "Punjab"], ["Book Corner", "Readers Hub", "Book Depot", "Learning Store"]),
    "Computing": ("Computing", ["Karachi", "Lahore", "Islamabad", "Punjab"], ["Tech Desk", "Computer Hub", "Digital Store", "PC Center"]),
    "Entertainment": ("Entertainment", ["Karachi", "Lahore", "Islamabad", "Punjab"], ["Media Mart", "Fun Store", "Game Hub", "Entertainment Co"]),
    "Health & Sports": ("Health", ["Karachi", "Lahore", "Punjab", "Islamabad"], ["Fitness Mart", "Health Store", "Sports Hub", "Wellness Co"]),
    "Home & Living": ("Home", ["Karachi", "Lahore", "Islamabad", "Punjab"], ["Living Store", "Home Hub", "Decor Mart", "House Goods"]),
    "Kids & Baby": ("Kids", ["Karachi", "Lahore", "Punjab", "Islamabad"], ["Baby Mart", "Kids Corner", "Tiny Trends", "Family Store"]),
    "Men's Fashion": ("Menswear", ["Karachi", "Lahore", "Punjab", "Islamabad"], ["Menswear Co", "Style House", "Urban Wear", "Fashion Mart"]),
    "Mobiles & Tablets": ("Mobile", ["Karachi", "Lahore", "Islamabad", "Punjab"], ["Mobile Wave", "TechHub", "Gadget Mart", "Device Center"]),
    "Others": ("General", ["Karachi", "Lahore", "Punjab", "Islamabad"], ["Bazaar Hub", "General Store", "Market House", "Value Mart"]),
    "School & Education": ("Education", ["Lahore", "Karachi", "Islamabad", "Punjab"], ["School Depot", "Learning Hub", "Student Store", "Education Mart"]),
    "Soghaat": ("Soghaat", ["Karachi", "Lahore", "Multan", "Punjab"], ["Gift House", "Soghaat Mart", "Treats Store", "Heritage Gifts"]),
    "Superstore": ("Superstore", ["Karachi", "Lahore", "Islamabad", "Punjab"], ["Supermart", "Value Store", "Daily Bazaar", "Market Hub"]),
    "UNCATEGORIZED": ("General", ["Karachi", "Lahore", "Pakistan", "Punjab"], ["Open Market", "Trade Hub", "Bazaar Store", "Commerce Co"]),
    "Women's Fashion": ("Womenswear", ["Karachi", "Lahore", "Punjab", "Islamabad"], ["Silk Route Boutique", "Urban Style PK", "Karachi Trends", "Fashion House"]),
}


@dataclass(frozen=True)
class LoadSummary:
    seller_users: int
    seller_user_roles: int
    stores: int
    categories: int
    products: int
    source_product_map: int
    orders: int
    source_order_map: int
    order_items: int


def _deterministic_id(entity_type: str, source_key: str) -> str:
    return str(uuid5(UUID_NAMESPACE, f"{entity_type}:{source_key}"))


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized or "uncategorized"


def _normalize_payment_method(value: str | None) -> str | None:
    if value is None or not str(value).strip():
        return None
    raw = str(value).strip()
    return PAYMENT_METHOD_MAP.get(raw.lower(), raw.upper().replace(" ", "_").replace("-", "_"))


def _normalize_order_status(value: str | None, default: str = "PENDING") -> str:
    if value is None or not str(value).strip():
        return default
    raw = str(value).strip()
    return STATUS_MAP.get(raw.lower(), raw.upper().replace(" ", "_").replace("-", "_"))


def _derive_payment_status(order_status: str) -> str:
    if order_status == "CANCELLED":
        return "FAILED"
    if order_status == "RETURNED":
        return "REFUNDED"
    return "PAID"


def _to_decimal(value: object, places: str = "0.01") -> Decimal:
    if value is None or pd.isna(value):
        return Decimal("0.00")
    return Decimal(str(value)).quantize(Decimal(places))


def _synthetic_stock(total_sales: object) -> int:
    sold = int(total_sales) if pd.notna(total_sales) else 0
    if sold <= 0:
        return 10
    return min(500, max(10, sold // 10))


def _first_not_null(series: pd.Series) -> object | None:
    cleaned = series.dropna()
    if cleaned.empty:
        return None
    for value in cleaned:
        if str(value).strip():
            return value
    return None


def _mode_or_first(series: pd.Series) -> object | None:
    cleaned = series.dropna()
    if cleaned.empty:
        return None
    mode = cleaned.mode()
    if not mode.empty:
        return mode.iloc[0]
    return cleaned.iloc[0]


def _product_title_from_code(product_code: str | None) -> str:
    if product_code is None or not str(product_code).strip():
        return "Unknown Product"
    return str(product_code).strip().replace("_", " ")


def _pakistan_store_product_id(source_product_id: object, store_id: str) -> str:
    return _deterministic_id("product", f"PAKISTAN_STORE_PRODUCT:{source_product_id}:{store_id}")


def _pakistan_store_product_sku(source_product_id: object, store_id: str) -> str:
    product_slug = _slugify(str(source_product_id)).upper().replace("-", "_")[:34]
    product_suffix = _deterministic_id("pakistan_product_sku", str(source_product_id)).replace("-", "")[:8].upper()
    store_suffix = str(store_id).replace("-", "")[:8].upper()
    return f"PK_{product_slug}_{product_suffix}_{store_suffix}"


def _normalize_pakistan_seller_code(value: object | None) -> str | None:
    if value is None or pd.isna(value):
        return None
    code = str(value).strip()
    if not code or code == r"\N":
        return None
    code = re.sub(r"[^A-Z0-9]+", "-", code.upper()).strip("-")
    return code or None


def _pakistan_seller_email(seller_code: str) -> str:
    slug = _slugify(seller_code)[:40]
    suffix = _deterministic_id("pakistan_seller_email", seller_code)[:8]
    return f"pakistan-seller-{slug}-{suffix}@pakistan.etl.local"


def _pakistan_synthetic_seller_email(seller_code: str) -> str:
    slug = _slugify(seller_code)[:40]
    suffix = _deterministic_id("pakistan_synthetic_seller_email", seller_code)[:8]
    return f"pakistan-synthetic-{slug}-{suffix}@pakistan.etl.local"


def _normalize_pakistan_category_name(value: object | None) -> str:
    if value is None or pd.isna(value) or not str(value).strip():
        return "UNCATEGORIZED"
    return str(value).strip()


def _pakistan_synthetic_seller_count(order_count: int) -> int:
    return max(1, math.ceil(order_count / PAKISTAN_SYNTHETIC_SELLER_TARGET_ORDERS))


def _pakistan_synthetic_seller_code(category_name: str, index: int) -> str:
    category_slug = _slugify(category_name).upper().replace("-", "_")
    return f"SYNTH_{category_slug}_{index:03d}"


def _pakistan_synthetic_store_name(category_name: str, index: int) -> str:
    _, cities, brands = PAKISTAN_SYNTHETIC_SELLER_THEMES.get(
        category_name,
        PAKISTAN_SYNTHETIC_SELLER_THEMES["UNCATEGORIZED"],
    )
    city = cities[index % len(cities)]
    brand = brands[(index // len(cities)) % len(brands)]
    return f"{city} {brand} {index + 1:02d}"


def _pakistan_synthetic_seller_index(order_id: object, seller_count: int) -> int:
    stable_id = _deterministic_id("pakistan_synthetic_seller_assignment", str(order_id))
    return int(stable_id.replace("-", "")[:8], 16) % seller_count


def _resolve_pakistan_order_store_id(
    seller_code: str | None,
    synthetic_category_name: object,
    order_id: object,
    real_store_lookup: dict[str, str],
    synthetic_seller_counts: dict[str, int],
) -> str:
    if seller_code:
        real_store_id = real_store_lookup.get(seller_code)
        if real_store_id:
            return real_store_id
    category_name = _normalize_pakistan_category_name(synthetic_category_name)
    seller_count = synthetic_seller_counts.get(category_name, 1)
    seller_index = _pakistan_synthetic_seller_index(order_id, seller_count)
    synthetic_seller_code = _pakistan_synthetic_seller_code(category_name, seller_index)
    return _deterministic_id("store", f"PAKISTAN_SYNTHETIC:{synthetic_seller_code}")


def country_to_currency(country: str | None) -> str:
    mapping = {
        "India": "INR",
        "United States": "USD",
        "Canada": "CAD",
        "Australia": "AUD",
        "United Kingdom": "GBP",
    }
    if country is None or not str(country).strip():
        return "USD"
    return mapping.get(str(country).strip(), "USD")


def _build_amazon_store_rows() -> tuple[list[tuple], dict[str, str]]:
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"seller_id": str})
    seller_ids = sorted(amazon["seller_id"].dropna().astype(str).unique().tolist())

    rows: list[tuple] = []
    store_lookup: dict[str, str] = {}
    for seller_id in seller_ids:
        store_id = _deterministic_id("store", f"AMAZON:{seller_id}")
        seller_user_id = _deterministic_id("user", f"AMAZON_SELLER:{seller_id}")
        store_lookup[seller_id] = store_id
        rows.append(
            (
                store_id,
                seller_user_id,
                f"AMAZON_STORE_{seller_id}",
                "OPEN",
                f"{seller_id.lower()}@amazon.etl.local",
            )
        )
    return rows, store_lookup


def _build_amazon_seller_user_rows() -> tuple[list[tuple], list[tuple]]:
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"seller_id": str})
    seller_ids = sorted(amazon["seller_id"].dropna().astype(str).unique().tolist())

    user_rows: list[tuple] = []
    role_rows: list[tuple] = []
    for seller_id in seller_ids:
        seller_user_id = _deterministic_id("user", f"AMAZON_SELLER:{seller_id}")
        user_rows.append(
            (
                seller_user_id,
                f"{seller_id.lower()}@amazon.etl.local",
                SYSTEM_ADMIN_PASSWORD_HASH,
                False,
                True,
                "Amazon Seller",
                seller_id,
            )
        )
        role_rows.append(
            (
                _deterministic_id("role", f"{seller_user_id}:CORPORATE"),
                seller_user_id,
                "CORPORATE",
                True,
            )
        )
    return user_rows, role_rows


def _build_pakistan_seller_store_rows() -> tuple[list[tuple], list[tuple], list[tuple], dict[str, str]]:
    pakistan = pd.read_csv(STAGING_DIR / "pakistan_staging.csv", usecols=["sales_commission_code"], dtype=str)
    seller_codes = sorted(
        {
            code
            for code in pakistan["sales_commission_code"].map(_normalize_pakistan_seller_code)
            if code is not None
        }
    )

    user_rows: list[tuple] = []
    role_rows: list[tuple] = []
    store_rows: list[tuple] = []
    store_lookup: dict[str, str] = {}
    for seller_code in seller_codes:
        seller_user_id = _deterministic_id("user", f"PAKISTAN_SELLER:{seller_code}")
        store_id = _deterministic_id("store", f"PAKISTAN:{seller_code}")
        seller_email = _pakistan_seller_email(seller_code)
        store_lookup[seller_code] = store_id

        user_rows.append(
            (
                seller_user_id,
                seller_email,
                SYSTEM_ADMIN_PASSWORD_HASH,
                False,
                True,
                "Pakistan Seller",
                seller_code,
            )
        )
        role_rows.append(
            (
                _deterministic_id("role", f"{seller_user_id}:CORPORATE"),
                seller_user_id,
                "CORPORATE",
                True,
            )
        )
        store_rows.append(
            (
                store_id,
                seller_user_id,
                f"PAKISTAN_SELLER_{seller_code}",
                "OPEN",
                seller_email,
            )
        )

    return user_rows, role_rows, store_rows, store_lookup


def _load_pakistan_synthetic_category_counts() -> dict[str, int]:
    pakistan = pd.read_csv(
        STAGING_DIR / "pakistan_staging.csv",
        usecols=["order_id", "sales_commission_code", "category_name"],
        dtype={"order_id": str, "sales_commission_code": str, "category_name": str},
    )
    pakistan["seller_code"] = pakistan["sales_commission_code"].map(_normalize_pakistan_seller_code)
    unassigned = pakistan.loc[pakistan["seller_code"].isna()].copy()
    unassigned["category_name"] = unassigned["category_name"].map(_normalize_pakistan_category_name)
    primary_categories = unassigned.groupby("order_id")["category_name"].agg(_mode_or_first)
    return primary_categories.value_counts().to_dict()


def _build_pakistan_synthetic_seller_store_rows() -> tuple[list[tuple], list[tuple], list[tuple], dict[str, int]]:
    category_counts = _load_pakistan_synthetic_category_counts()

    user_rows: list[tuple] = []
    role_rows: list[tuple] = []
    store_rows: list[tuple] = []
    category_seller_counts: dict[str, int] = {}

    for category_name, order_count in sorted(category_counts.items()):
        seller_count = _pakistan_synthetic_seller_count(order_count)
        category_seller_counts[category_name] = seller_count
        for index in range(seller_count):
            seller_code = _pakistan_synthetic_seller_code(category_name, index)
            seller_user_id = _deterministic_id("user", f"PAKISTAN_SYNTHETIC_SELLER:{seller_code}")
            store_id = _deterministic_id("store", f"PAKISTAN_SYNTHETIC:{seller_code}")
            seller_email = _pakistan_synthetic_seller_email(seller_code)

            user_rows.append(
                (
                    seller_user_id,
                    seller_email,
                    SYSTEM_ADMIN_PASSWORD_HASH,
                    False,
                    True,
                    "Pakistan Synthetic Seller",
                    seller_code,
                )
            )
            role_rows.append(
                (
                    _deterministic_id("role", f"{seller_user_id}:CORPORATE"),
                    seller_user_id,
                    "CORPORATE",
                    True,
                )
            )
            store_rows.append(
                (
                    store_id,
                    seller_user_id,
                    _pakistan_synthetic_store_name(category_name, index),
                    "OPEN",
                    seller_email,
                )
            )

    return user_rows, role_rows, store_rows, category_seller_counts


def _build_category_rows() -> tuple[list[tuple], dict[str, str]]:
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", usecols=["category_name"])
    pakistan = pd.read_csv(STAGING_DIR / "pakistan_staging.csv", usecols=["category_name"])
    category_names = sorted(
        set(amazon["category_name"].dropna().astype(str).tolist())
        | set(pakistan["category_name"].dropna().astype(str).tolist())
    )

    rows: list[tuple] = []
    category_lookup = {UNCATEGORIZED_SLUG: _deterministic_id("category", UNCATEGORIZED_SLUG)}
    for category_name in category_names:
        slug = _slugify(category_name)
        category_id = _deterministic_id("category", slug)
        category_lookup[slug] = category_id
        rows.append((category_id, category_name, slug, None, 0, True))
    return rows, category_lookup


def _build_products() -> tuple[list[tuple], list[tuple]]:
    source_product_map = pd.read_csv(MAPPINGS_DIR / "source_product_map.csv", dtype=str)
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"product_id": str, "seller_id": str})
    online_retail = pd.read_csv(STAGING_DIR / "online_retail_staging.csv", dtype={"stock_code": str})
    pakistan = pd.read_csv(STAGING_DIR / "pakistan_staging.csv", dtype={"product_id": str, "order_id": str, "customer_id": str})

    store_rows, amazon_store_lookup = _build_amazon_store_rows()
    _, _, _, pakistan_store_lookup = _build_pakistan_seller_store_rows()
    _, _, _, pakistan_synthetic_seller_counts = _build_pakistan_synthetic_seller_store_rows()
    _, category_lookup = _build_category_rows()

    amazon_grouped = (
        amazon.groupby("product_id", as_index=False)
        .agg(
            product_name=("product_name", _first_not_null),
            brand=("brand", _first_not_null),
            category_name=("category_name", _mode_or_first),
            seller_id=("seller_id", _mode_or_first),
            source_country=("country", _mode_or_first),
            unit_price=("unit_price", "median"),
            discount_amount=("discount_amount", "median"),
            total_sales=("quantity", "sum"),
        )
    )
    amazon_products = amazon_grouped.merge(
        source_product_map.loc[source_product_map["source_system"] == AMAZON_SOURCE].rename(
            columns={"product_id": "unified_product_id"}
        ),
        left_on="product_id",
        right_on="source_product_id",
        how="inner",
    )

    online_retail["quantity"] = pd.to_numeric(online_retail["quantity"], errors="coerce")
    online_retail["positive_quantity"] = online_retail["quantity"].clip(lower=0)
    online_grouped = (
        online_retail.groupby("stock_code", as_index=False)
        .agg(
            product_name=("description", _first_not_null),
            category_name=("category_name", _mode_or_first),
            unit_price=("unit_price", "median"),
            total_sales=("positive_quantity", "sum"),
        )
    )
    online_products = online_grouped.merge(
        source_product_map.loc[source_product_map["source_system"] == ONLINE_RETAIL_SOURCE].rename(
            columns={"product_id": "unified_product_id"}
        ),
        left_on="stock_code",
        right_on="source_product_id",
        how="inner",
    )

    pakistan["seller_code"] = pakistan["sales_commission_code"].map(_normalize_pakistan_seller_code).fillna("")
    pakistan["synthetic_category_name"] = pakistan["category_name"].map(_normalize_pakistan_category_name)
    pakistan_order_sellers = (
        pakistan.groupby("order_id", as_index=False)
        .agg(
            seller_code=("seller_code", _mode_or_first),
            synthetic_category_name=("synthetic_category_name", _mode_or_first),
        )
    )
    pakistan_order_sellers["seller_store_id"] = pakistan_order_sellers.apply(
        lambda row: _resolve_pakistan_order_store_id(
            row["seller_code"],
            row["synthetic_category_name"],
            row["order_id"],
            pakistan_store_lookup,
            pakistan_synthetic_seller_counts,
        ),
        axis=1,
    )
    pakistan = pakistan.merge(pakistan_order_sellers[["order_id", "seller_store_id"]], on="order_id", how="left")

    pakistan_canonical_grouped = (
        pakistan.groupby("product_id", as_index=False)
        .agg(
            category_name=("category_name", _mode_or_first),
            unit_price=("unit_price", "median"),
            total_sales=("quantity", "sum"),
        )
    )
    pakistan_canonical_products = pakistan_canonical_grouped.merge(
        source_product_map.loc[source_product_map["source_system"] == PAKISTAN_SOURCE].rename(
            columns={"product_id": "unified_product_id"}
        ),
        left_on="product_id",
        right_on="source_product_id",
        how="inner",
    )

    pakistan_grouped = (
        pakistan.groupby(["product_id", "seller_store_id"], as_index=False)
        .agg(
            category_name=("category_name", _mode_or_first),
            unit_price=("unit_price", "median"),
            total_sales=("quantity", "sum"),
        )
    )
    pakistan_products = pakistan_grouped.merge(
        source_product_map.loc[source_product_map["source_system"] == PAKISTAN_SOURCE].rename(
            columns={"product_id": "unified_product_id"}
        ),
        left_on="product_id",
        right_on="source_product_id",
        how="inner",
    )

    online_retail_store_id = _deterministic_id("store", ONLINE_RETAIL_STORE_NAME)
    pakistan_store_id = _deterministic_id("store", PAKISTAN_STORE_NAME)

    product_rows: list[tuple] = []
    source_product_rows: list[tuple] = []

    for row in amazon_products.itertuples(index=False):
        slug = _slugify(str(row.category_name))
        raw_discount = float(row.discount_amount) if pd.notna(row.discount_amount) else 0.0
        discount_percentage = raw_discount * 100 if raw_discount <= 1 else raw_discount
        product_rows.append(
            (
                row.unified_product_id,
                amazon_store_lookup[str(row.seller_id)],
                category_lookup[slug],
                str(row.source_product_id),
                str(row.product_name),
                None,
                str(row.brand) if pd.notna(row.brand) else None,
                country_to_currency(row.source_country if pd.notna(row.source_country) else None),
                str(row.source_country) if pd.notna(row.source_country) else None,
                _to_decimal(row.unit_price),
                Decimal(str(discount_percentage)).quantize(Decimal("0.01")),
                _synthetic_stock(row.total_sales),
                int(row.total_sales) if pd.notna(row.total_sales) else 0,
                True,
            )
        )
        source_product_rows.append(
            (
                _deterministic_id("source_product_map", f"{row.source_system}:{row.source_product_id}"),
                row.source_system,
                row.source_product_id,
                row.unified_product_id,
            )
        )

    for row in online_products.itertuples(index=False):
        product_rows.append(
            (
                row.unified_product_id,
                online_retail_store_id,
                category_lookup[UNCATEGORIZED_SLUG],
                str(row.source_product_id),
                str(row.product_name),
                None,
                None,
                "GBP",
                None,
                _to_decimal(row.unit_price),
                Decimal("0.00"),
                _synthetic_stock(row.total_sales),
                int(row.total_sales) if pd.notna(row.total_sales) else 0,
                True,
            )
        )
        source_product_rows.append(
            (
                _deterministic_id("source_product_map", f"{row.source_system}:{row.source_product_id}"),
                row.source_system,
                row.source_product_id,
                row.unified_product_id,
            )
        )

    for row in pakistan_products.itertuples(index=False):
        slug = _slugify(str(row.category_name)) if pd.notna(row.category_name) else UNCATEGORIZED_SLUG
        category_id = category_lookup.get(slug, category_lookup[UNCATEGORIZED_SLUG])
        product_id = _pakistan_store_product_id(row.source_product_id, row.seller_store_id)
        product_rows.append(
            (
                product_id,
                row.seller_store_id or pakistan_store_id,
                category_id,
                _pakistan_store_product_sku(row.source_product_id, row.seller_store_id),
                _product_title_from_code(row.source_product_id),
                None,
                None,
                "PKR",
                None,
                _to_decimal(row.unit_price),
                Decimal("0.00"),
                _synthetic_stock(row.total_sales),
                int(row.total_sales) if pd.notna(row.total_sales) else 0,
                True,
            )
        )

    for row in pakistan_canonical_products.itertuples(index=False):
        slug = _slugify(str(row.category_name)) if pd.notna(row.category_name) else UNCATEGORIZED_SLUG
        category_id = category_lookup.get(slug, category_lookup[UNCATEGORIZED_SLUG])
        product_rows.append(
            (
                row.unified_product_id,
                pakistan_store_id,
                category_id,
                str(row.source_product_id),
                _product_title_from_code(row.source_product_id),
                None,
                None,
                "PKR",
                None,
                _to_decimal(row.unit_price),
                Decimal("0.00"),
                _synthetic_stock(row.total_sales),
                int(row.total_sales) if pd.notna(row.total_sales) else 0,
                True,
            )
        )
        source_product_rows.append(
            (
                _deterministic_id("source_product_map", f"{row.source_system}:{row.source_product_id}"),
                row.source_system,
                row.source_product_id,
                row.unified_product_id,
            )
        )

    return product_rows, source_product_rows


def _build_orders() -> tuple[list[tuple], list[tuple], list[tuple]]:
    source_customer_map = pd.read_csv(MAPPINGS_DIR / "source_customer_map.csv", dtype=str)
    source_product_map = pd.read_csv(MAPPINGS_DIR / "source_product_map.csv", dtype=str)
    source_order_map = pd.read_csv(MAPPINGS_DIR / "source_order_map.csv", dtype=str)
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"customer_id": str, "order_id": str, "product_id": str, "seller_id": str})
    online_retail = pd.read_csv(STAGING_DIR / "online_retail_staging.csv", dtype={"customer_id": str, "invoice_no": str, "stock_code": str})
    pakistan = pd.read_csv(
        STAGING_DIR / "pakistan_staging.csv",
        dtype={"customer_id": str, "order_id": str, "product_id": str, "line_item_id": str, "sales_commission_code": str},
    )

    _, amazon_store_lookup = _build_amazon_store_rows()
    _, _, _, pakistan_store_lookup = _build_pakistan_seller_store_rows()
    _, _, _, pakistan_synthetic_seller_counts = _build_pakistan_synthetic_seller_store_rows()
    online_retail_store_id = _deterministic_id("store", ONLINE_RETAIL_STORE_NAME)
    pakistan_store_id = _deterministic_id("store", PAKISTAN_STORE_NAME)

    amazon_customer_map = source_customer_map.loc[source_customer_map["source_system"] == AMAZON_SOURCE].rename(
        columns={"source_customer_id": "customer_id"}
    )
    amazon_product_map = source_product_map.loc[source_product_map["source_system"] == AMAZON_SOURCE].rename(
        columns={"source_product_id": "product_id", "product_id": "unified_product_id"}
    )
    amazon_order_map = source_order_map.loc[source_order_map["source_system"] == AMAZON_SOURCE].rename(
        columns={"source_order_id": "order_id", "order_id": "unified_order_id"}
    )

    amazon_orders = (
        amazon.merge(amazon_customer_map, on=["source_system", "customer_id"], how="inner")
        .merge(amazon_product_map, on=["source_system", "product_id"], how="inner")
        .merge(amazon_order_map, on=["source_system", "order_id"], how="inner")
    )

    order_rows: list[tuple] = []
    source_order_rows: list[tuple] = []
    order_item_rows: list[tuple] = []

    for row in amazon_orders.itertuples(index=False):
        status = _normalize_order_status(row.order_status, default="DELIVERED")
        payment_method = _normalize_payment_method(row.payment_method)
        subtotal = _to_decimal(float(row.quantity) * float(row.unit_price))
        tax_amount = _to_decimal(row.tax_amount)
        shipping_fee = _to_decimal(row.shipping_cost)
        grand_total = _to_decimal(row.total_amount)
        user_email = f"{row.source_system.lower()}_{row.customer_id}@etl.local".lower()

        order_rows.append(
            (
                row.unified_order_id,
                row.user_id,
                amazon_store_lookup[str(row.seller_id)],
                row.order_id,
                row.order_date,
                status,
                _derive_payment_status(status),
                payment_method,
                subtotal,
                Decimal("0.00"),
                shipping_fee,
                tax_amount,
                grand_total,
                "USD",
                str(row.city) if pd.notna(row.city) else None,
                str(row.state) if pd.notna(row.state) else None,
                str(row.country) if pd.notna(row.country) else None,
                user_email,
            )
        )

        source_order_rows.append(
            (
                _deterministic_id("source_order_map", f"{row.source_system}:{row.order_id}"),
                row.source_system,
                row.order_id,
                row.unified_order_id,
            )
        )

        order_item_rows.append(
            (
                _deterministic_id("order_item", f"{row.source_system}:{row.order_id}:{row.product_id}:{row.source_row_number}"),
                row.unified_order_id,
                row.unified_product_id,
                int(row.quantity),
                _to_decimal(row.unit_price),
                _to_decimal(row.discount_amount),
                subtotal,
                "NONE",
                0,
            )
        )

    online_retail["quantity"] = pd.to_numeric(online_retail["quantity"], errors="coerce")
    online_retail = online_retail.loc[online_retail["quantity"] > 0].copy()

    online_customer_map = source_customer_map.loc[source_customer_map["source_system"] == ONLINE_RETAIL_SOURCE].rename(
        columns={"source_customer_id": "customer_id"}
    )
    online_product_map = source_product_map.loc[source_product_map["source_system"] == ONLINE_RETAIL_SOURCE].rename(
        columns={"source_product_id": "stock_code", "product_id": "unified_product_id"}
    )
    online_order_map = source_order_map.loc[source_order_map["source_system"] == ONLINE_RETAIL_SOURCE].rename(
        columns={"source_order_id": "invoice_no", "order_id": "unified_order_id"}
    )

    online_items = (
        online_retail.merge(online_customer_map, on=["source_system", "customer_id"], how="inner")
        .merge(online_product_map, on=["source_system", "stock_code"], how="inner")
        .merge(online_order_map, on=["source_system", "invoice_no"], how="inner")
    )

    grouped_orders = (
        online_items.groupby(["source_system", "invoice_no", "unified_order_id", "user_id", "customer_id"], as_index=False)
        .agg(
            order_date=("invoice_date", "min"),
            shipping_country=("country", _mode_or_first),
            subtotal=("quantity", lambda s: float((online_items.loc[s.index, "quantity"] * pd.to_numeric(online_items.loc[s.index, "unit_price"], errors="coerce")).sum())),
        )
    )

    for row in grouped_orders.itertuples(index=False):
        user_email = f"{row.source_system.lower()}_{row.customer_id}@etl.local".lower()
        subtotal = _to_decimal(row.subtotal)
        order_rows.append(
            (
                row.unified_order_id,
                row.user_id,
                online_retail_store_id,
                row.invoice_no,
                row.order_date,
                "DELIVERED",
                "PAID",
                None,
                subtotal,
                Decimal("0.00"),
                Decimal("0.00"),
                Decimal("0.00"),
                subtotal,
                "GBP",
                None,
                None,
                str(row.shipping_country) if pd.notna(row.shipping_country) else None,
                user_email,
            )
        )
        source_order_rows.append(
            (
                _deterministic_id("source_order_map", f"{row.source_system}:{row.invoice_no}"),
                row.source_system,
                row.invoice_no,
                row.unified_order_id,
            )
        )

    for row in online_items.itertuples(index=False):
        subtotal = _to_decimal(float(row.quantity) * float(row.unit_price))
        order_item_rows.append(
            (
                _deterministic_id("order_item", f"{row.source_system}:{row.invoice_no}:{row.stock_code}:{row.source_row_number}"),
                row.unified_order_id,
                row.unified_product_id,
                int(row.quantity),
                _to_decimal(row.unit_price),
                Decimal("0.00"),
                subtotal,
                "NONE",
                0,
            )
        )

    pakistan_customer_map = source_customer_map.loc[source_customer_map["source_system"] == PAKISTAN_SOURCE].rename(
        columns={"source_customer_id": "customer_id"}
    )
    pakistan_product_map = source_product_map.loc[source_product_map["source_system"] == PAKISTAN_SOURCE].rename(
        columns={"source_product_id": "product_id", "product_id": "unified_product_id"}
    )
    pakistan_order_map = source_order_map.loc[source_order_map["source_system"] == PAKISTAN_SOURCE].rename(
        columns={"source_order_id": "order_id", "order_id": "unified_order_id"}
    )
    pakistan_items = (
        pakistan.merge(pakistan_customer_map, on=["source_system", "customer_id"], how="inner")
        .merge(pakistan_product_map, on=["source_system", "product_id"], how="inner")
        .merge(pakistan_order_map, on=["source_system", "order_id"], how="inner")
    )
    pakistan_items["seller_code"] = pakistan_items["sales_commission_code"].map(_normalize_pakistan_seller_code).fillna("")
    pakistan_items["synthetic_category_name"] = pakistan_items["category_name"].map(_normalize_pakistan_category_name)
    pakistan_items["seller_store_id"] = pakistan_items.apply(
        lambda row: _resolve_pakistan_order_store_id(
            row["seller_code"],
            row["synthetic_category_name"],
            row["order_id"],
            pakistan_store_lookup,
            pakistan_synthetic_seller_counts,
        ),
        axis=1,
    )

    grouped_pakistan_orders = (
        pakistan_items.groupby(["source_system", "order_id", "unified_order_id", "user_id", "customer_id", "seller_code", "seller_store_id"], as_index=False)
        .agg(
            order_date=("order_date", "min"),
            status=("order_status", _mode_or_first),
            payment_method=("payment_method", _mode_or_first),
            synthetic_category_name=("synthetic_category_name", _mode_or_first),
            subtotal=("quantity", lambda s: float((pakistan_items.loc[s.index, "quantity"] * pd.to_numeric(pakistan_items.loc[s.index, "unit_price"], errors="coerce")).sum())),
            grand_total=("grand_total", "max"),
            discount_amount=("discount_amount", "sum"),
        )
    )

    for row in grouped_pakistan_orders.itertuples(index=False):
        user_email = f"{row.source_system.lower()}_{row.customer_id}@etl.local".lower()
        subtotal = _to_decimal(row.subtotal)
        discount_amount = abs(_to_decimal(row.discount_amount))
        grand_total = _to_decimal(row.grand_total)
        if grand_total == Decimal("0.00") and subtotal > Decimal("0.00"):
            grand_total = subtotal - discount_amount
        order_rows.append(
            (
                row.unified_order_id,
                row.user_id,
                row.seller_store_id or pakistan_store_id,
                str(row.order_id),
                row.order_date,
                _normalize_order_status(row.status, default="PENDING"),
                _derive_payment_status(_normalize_order_status(row.status, default="PENDING")),
                _normalize_payment_method(row.payment_method),
                subtotal,
                discount_amount,
                Decimal("0.00"),
                Decimal("0.00"),
                grand_total if grand_total > Decimal("0.00") else subtotal,
                "PKR",
                None,
                None,
                "Pakistan",
                user_email,
            )
        )
        source_order_rows.append(
            (
                _deterministic_id("source_order_map", f"{row.source_system}:{row.order_id}"),
                row.source_system,
                row.order_id,
                row.unified_order_id,
            )
        )

    for row in pakistan_items.itertuples(index=False):
        subtotal = _to_decimal(float(row.quantity) * float(row.unit_price))
        order_item_rows.append(
            (
                _deterministic_id("order_item", f"{row.source_system}:{row.order_id}:{row.line_item_id}"),
                row.unified_order_id,
                _pakistan_store_product_id(row.product_id, row.seller_store_id),
                int(row.quantity),
                _to_decimal(row.unit_price),
                Decimal("0.00"),
                subtotal,
                "NONE",
                0,
            )
        )

    return order_rows, source_order_rows, order_item_rows


def load_phase_2_catalog_and_orders() -> LoadSummary:
    amazon_seller_user_rows, amazon_seller_role_rows = _build_amazon_seller_user_rows()
    pakistan_seller_user_rows, pakistan_seller_role_rows, pakistan_store_rows, _ = _build_pakistan_seller_store_rows()
    pakistan_synthetic_user_rows, pakistan_synthetic_role_rows, pakistan_synthetic_store_rows, _ = _build_pakistan_synthetic_seller_store_rows()
    amazon_store_rows, _ = _build_amazon_store_rows()
    seller_user_rows = amazon_seller_user_rows + pakistan_seller_user_rows + pakistan_synthetic_user_rows
    seller_role_rows = amazon_seller_role_rows + pakistan_seller_role_rows + pakistan_synthetic_role_rows
    store_rows = amazon_store_rows + pakistan_store_rows + pakistan_synthetic_store_rows
    category_rows, _ = _build_category_rows()
    product_rows, source_product_rows = _build_products()
    order_rows, source_order_rows, order_item_rows = _build_orders()

    ensure_directory(LOG_DIR)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE order_items, source_order_map, orders, source_product_map, products RESTART IDENTITY CASCADE")
            cursor.execute(
                """
                DELETE FROM categories
                WHERE slug <> %s
                """,
                (UNCATEGORIZED_SLUG,),
            )
            cursor.execute(
                """
                DELETE FROM stores
                WHERE name NOT IN (%s, %s)
                """,
                (ONLINE_RETAIL_STORE_NAME, PAKISTAN_STORE_NAME),
            )

            cursor.executemany(
                """
                INSERT INTO users (id, email, password_hash, email_verified, is_active, first_name, last_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET email = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash,
                    email_verified = EXCLUDED.email_verified,
                    is_active = EXCLUDED.is_active,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name
                """,
                seller_user_rows,
            )

            cursor.executemany(
                """
                INSERT INTO user_roles (id, user_id, role_type, is_active_role)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, role_type) DO UPDATE
                SET is_active_role = EXCLUDED.is_active_role
                """,
                seller_role_rows,
            )

            cursor.executemany(
                """
                INSERT INTO stores (id, owner_id, name, status, contact_email)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET owner_id = EXCLUDED.owner_id,
                    name = EXCLUDED.name,
                    status = EXCLUDED.status,
                    contact_email = EXCLUDED.contact_email
                """,
                store_rows,
            )

            cursor.executemany(
                """
                INSERT INTO categories (id, name, slug, parent_id, level, is_active)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name,
                    parent_id = EXCLUDED.parent_id,
                    level = EXCLUDED.level,
                    is_active = EXCLUDED.is_active
                """,
                category_rows,
            )

            cursor.executemany(
                """
                INSERT INTO products (
                    id, store_id, category_id, sku, title, description, brand, currency, source_country,
                    unit_price, discount_percentage, stock_quantity, total_sales, is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                product_rows,
            )

            cursor.executemany(
                """
                INSERT INTO source_product_map (id, source_system, source_product_id, product_id)
                VALUES (%s, %s, %s, %s)
                """,
                source_product_rows,
            )

            cursor.executemany(
                """
                INSERT INTO orders (
                    id, user_id, store_id, increment_id, order_date, status, payment_status,
                    payment_method, subtotal, discount_amount, shipping_fee, tax_amount,
                    grand_total, currency, shipping_city, shipping_state, shipping_country, customer_email
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                order_rows,
            )

            cursor.executemany(
                """
                INSERT INTO source_order_map (id, source_system, source_order_id, order_id)
                VALUES (%s, %s, %s, %s)
                """,
                source_order_rows,
            )

            cursor.executemany(
                """
                INSERT INTO order_items (
                    id, order_id, product_id, quantity, unit_price_at_purchase,
                    discount_applied, subtotal, return_status, returned_quantity
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                order_item_rows,
            )

    summary = LoadSummary(
        seller_users=len(seller_user_rows),
        seller_user_roles=len(seller_role_rows),
        stores=len(store_rows) + 2,
        categories=len(category_rows) + 1,
        products=len(product_rows),
        source_product_map=len(source_product_rows),
        orders=len(order_rows),
        source_order_map=len(source_order_rows),
        order_items=len(order_item_rows),
    )
    append_run_log(
        [
            "phase=4",
            "step=load_catalog_and_orders",
            f"seller_users={summary.seller_users}",
            f"seller_user_roles={summary.seller_user_roles}",
            f"stores={summary.stores}",
            f"categories={summary.categories}",
            f"products={summary.products}",
            f"source_product_map={summary.source_product_map}",
            f"orders={summary.orders}",
            f"source_order_map={summary.source_order_map}",
            f"order_items={summary.order_items}",
        ]
    )
    return summary


def main() -> None:
    summary = load_phase_2_catalog_and_orders()
    print(
        "PHASE 4 CATALOG LOAD: "
        f"seller_users={summary.seller_users}, "
        f"seller_user_roles={summary.seller_user_roles}, "
        f"stores={summary.stores}, "
        f"categories={summary.categories}, "
        f"products={summary.products}, "
        f"source_product_map={summary.source_product_map}, "
        f"orders={summary.orders}, "
        f"source_order_map={summary.source_order_map}, "
        f"order_items={summary.order_items}"
    )


if __name__ == "__main__":
    main()
