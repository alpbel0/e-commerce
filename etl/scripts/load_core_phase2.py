from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import re
from uuid import uuid5

import pandas as pd

from config import LOG_DIR, MAPPINGS_DIR, PAYMENT_METHOD_MAP, STAGING_DIR, STATUS_MAP, UUID_NAMESPACE
from db import get_connection
from load_core_phase1 import ONLINE_RETAIL_STORE_NAME, PAKISTAN_STORE_NAME, SYSTEM_ADMIN_EMAIL, UNCATEGORIZED_SLUG
from utils import append_run_log, ensure_directory


AMAZON_SOURCE = "AMAZON"
ONLINE_RETAIL_SOURCE = "ONLINE_RETAIL"


@dataclass(frozen=True)
class LoadSummary:
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


def _build_amazon_store_rows() -> tuple[list[tuple], dict[str, str]]:
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"seller_id": str})
    seller_ids = sorted(amazon["seller_id"].dropna().astype(str).unique().tolist())
    admin_user_id = _deterministic_id("user", SYSTEM_ADMIN_EMAIL)

    rows: list[tuple] = []
    store_lookup: dict[str, str] = {}
    for seller_id in seller_ids:
        store_id = _deterministic_id("store", f"AMAZON:{seller_id}")
        store_lookup[seller_id] = store_id
        rows.append(
            (
                store_id,
                admin_user_id,
                f"AMAZON_STORE_{seller_id}",
                "OPEN",
                f"{seller_id.lower()}@amazon.etl.local",
            )
        )
    return rows, store_lookup


def _build_category_rows() -> tuple[list[tuple], dict[str, str]]:
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", usecols=["category_name"])
    category_names = sorted(amazon["category_name"].dropna().astype(str).unique().tolist())

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

    store_rows, amazon_store_lookup = _build_amazon_store_rows()
    _, category_lookup = _build_category_rows()

    amazon_grouped = (
        amazon.groupby("product_id", as_index=False)
        .agg(
            product_name=("product_name", _first_not_null),
            brand=("brand", _first_not_null),
            category_name=("category_name", _mode_or_first),
            seller_id=("seller_id", _mode_or_first),
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

    online_retail_store_id = _deterministic_id("store", ONLINE_RETAIL_STORE_NAME)

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
                _to_decimal(row.unit_price),
                Decimal(str(discount_percentage)).quantize(Decimal("0.01")),
                0,
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
                _to_decimal(row.unit_price),
                Decimal("0.00"),
                0,
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

    _, amazon_store_lookup = _build_amazon_store_rows()
    online_retail_store_id = _deterministic_id("store", ONLINE_RETAIL_STORE_NAME)

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

    return order_rows, source_order_rows, order_item_rows


def load_phase_2_catalog_and_orders() -> LoadSummary:
    store_rows, _ = _build_amazon_store_rows()
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
                    id, store_id, category_id, sku, title, description, brand,
                    unit_price, discount_percentage, stock_quantity, total_sales, is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
