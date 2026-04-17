from __future__ import annotations

from decimal import Decimal

import pandas as pd

from config import MAPPINGS_DIR, STAGING_DIR
from db import get_connection
from load_core_phase1 import PAKISTAN_STORE_NAME, SYSTEM_ADMIN_EMAIL, SYSTEM_ADMIN_PASSWORD_HASH, UNCATEGORIZED_SLUG, _deterministic_id
from load_core_phase2 import (
    PAKISTAN_SOURCE,
    _derive_payment_status,
    _mode_or_first,
    _normalize_order_status,
    _normalize_payment_method,
    _product_title_from_code,
    _slugify,
    _synthetic_stock,
    _to_decimal,
)


def main() -> None:
    pakistan = pd.read_csv(
        STAGING_DIR / "pakistan_staging.csv",
        dtype={"customer_id": str, "order_id": str, "product_id": str, "line_item_id": str},
    )
    source_customer_map = pd.read_csv(MAPPINGS_DIR / "source_customer_map.csv", dtype=str)
    source_product_map = pd.read_csv(MAPPINGS_DIR / "source_product_map.csv", dtype=str)
    source_order_map = pd.read_csv(MAPPINGS_DIR / "source_order_map.csv", dtype=str)

    pakistan_customer_map = source_customer_map.loc[source_customer_map["source_system"] == PAKISTAN_SOURCE].copy()
    pakistan_product_map = source_product_map.loc[source_product_map["source_system"] == PAKISTAN_SOURCE].copy()
    pakistan_order_map = source_order_map.loc[source_order_map["source_system"] == PAKISTAN_SOURCE].copy()

    system_admin_id = _deterministic_id("user", SYSTEM_ADMIN_EMAIL)
    pakistan_store_id = _deterministic_id("store", PAKISTAN_STORE_NAME)

    category_names = sorted(set(pakistan["category_name"].dropna().astype(str).tolist()))
    category_rows: list[tuple] = []
    category_lookup = {UNCATEGORIZED_SLUG: _deterministic_id("category", UNCATEGORIZED_SLUG)}
    for category_name in category_names:
        slug = _slugify(category_name)
        category_lookup[slug] = _deterministic_id("category", slug)
        category_rows.append((category_lookup[slug], category_name, slug, None, 0, True))

    user_rows = []
    role_rows = []
    profile_rows = []
    source_customer_rows = []
    for row in pakistan_customer_map.itertuples(index=False):
        email = f"{PAKISTAN_SOURCE.lower()}_{row.source_customer_id}@etl.local".lower()
        user_rows.append((row.user_id, email, SYSTEM_ADMIN_PASSWORD_HASH, False, True, "Customer", str(row.source_customer_id)))
        role_rows.append((_deterministic_id("role", f"{row.user_id}:INDIVIDUAL"), row.user_id, "INDIVIDUAL", True))
        profile_rows.append((_deterministic_id("customer_profile", row.user_id), row.user_id, None, None, None, None, "Pakistan", None, 0.0, 0, None))
        source_customer_rows.append(
            (_deterministic_id("source_customer_map", f"{row.source_system}:{row.source_customer_id}"), row.source_system, row.source_customer_id, row.user_id)
        )

    pakistan_grouped_products = (
        pakistan.groupby("product_id", as_index=False)
        .agg(
            category_name=("category_name", _mode_or_first),
            unit_price=("unit_price", "median"),
            total_sales=("quantity", "sum"),
        )
    )
    pakistan_products = pakistan_grouped_products.merge(
        pakistan_product_map.rename(columns={"source_product_id": "product_id", "product_id": "unified_product_id"}),
        on="product_id",
        how="inner",
    )

    product_rows = []
    source_product_rows = []
    for row in pakistan_products.itertuples(index=False):
        slug = _slugify(str(row.category_name)) if pd.notna(row.category_name) else UNCATEGORIZED_SLUG
        category_id = category_lookup.get(slug, category_lookup[UNCATEGORIZED_SLUG])
        product_rows.append(
            (
                row.unified_product_id,
                pakistan_store_id,
                category_id,
                str(row.product_id),
                _product_title_from_code(row.product_id),
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
            (_deterministic_id("source_product_map", f"{row.source_system}:{row.product_id}"), row.source_system, row.product_id, row.unified_product_id)
        )

    pakistan_items = (
        pakistan.merge(pakistan_customer_map.rename(columns={"source_customer_id": "customer_id"}), on=["source_system", "customer_id"], how="inner")
        .merge(pakistan_product_map.rename(columns={"source_product_id": "product_id", "product_id": "unified_product_id"}), on=["source_system", "product_id"], how="inner")
        .merge(pakistan_order_map.rename(columns={"source_order_id": "order_id", "order_id": "unified_order_id"}), on=["source_system", "order_id"], how="inner")
    )
    grouped_orders = (
        pakistan_items.groupby(["source_system", "order_id", "unified_order_id", "user_id", "customer_id"], as_index=False)
        .agg(
            order_date=("order_date", "min"),
            status=("order_status", _mode_or_first),
            payment_method=("payment_method", _mode_or_first),
            subtotal=("quantity", lambda s: float((pakistan_items.loc[s.index, "quantity"] * pd.to_numeric(pakistan_items.loc[s.index, "unit_price"], errors="coerce")).sum())),
            grand_total=("grand_total", "max"),
            discount_amount=("discount_amount", "sum"),
        )
    )

    order_rows = []
    source_order_rows = []
    order_item_rows = []
    for row in grouped_orders.itertuples(index=False):
        normalized_status = _normalize_order_status(row.status, default="PENDING")
        subtotal = _to_decimal(row.subtotal)
        discount_amount = abs(_to_decimal(row.discount_amount))
        grand_total = _to_decimal(row.grand_total)
        if grand_total == Decimal("0.00") and subtotal > Decimal("0.00"):
            grand_total = subtotal - discount_amount
        user_email = f"{PAKISTAN_SOURCE.lower()}_{row.customer_id}@etl.local".lower()
        order_rows.append(
            (
                row.unified_order_id,
                row.user_id,
                pakistan_store_id,
                str(row.order_id),
                row.order_date,
                normalized_status,
                _derive_payment_status(normalized_status),
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
            (_deterministic_id("source_order_map", f"{row.source_system}:{row.order_id}"), row.source_system, row.order_id, row.unified_order_id)
        )

    for row in pakistan_items.itertuples(index=False):
        subtotal = _to_decimal(float(row.quantity) * float(row.unit_price))
        order_item_rows.append(
            (
                _deterministic_id("order_item", f"{row.source_system}:{row.order_id}:{row.line_item_id}"),
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

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO users (id, email, password_hash, email_verified, is_active, first_name, last_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (system_admin_id, SYSTEM_ADMIN_EMAIL, SYSTEM_ADMIN_PASSWORD_HASH, True, True, "System", "Administrator"),
            )
            cursor.execute(
                """
                INSERT INTO stores (id, owner_id, name, status, contact_email)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET owner_id = EXCLUDED.owner_id,
                    name = EXCLUDED.name,
                    status = EXCLUDED.status,
                    contact_email = EXCLUDED.contact_email
                """,
                (pakistan_store_id, system_admin_id, PAKISTAN_STORE_NAME, "OPEN", SYSTEM_ADMIN_EMAIL),
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
                INSERT INTO users (id, email, password_hash, email_verified, is_active, first_name, last_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                user_rows,
            )
            cursor.executemany(
                """
                INSERT INTO user_roles (id, user_id, role_type, is_active_role)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, role_type) DO NOTHING
                """,
                role_rows,
            )
            cursor.executemany(
                """
                INSERT INTO source_customer_map (id, source_system, source_customer_id, user_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (source_system, source_customer_id) DO NOTHING
                """,
                source_customer_rows,
            )
            cursor.executemany(
                """
                INSERT INTO customer_profiles (
                    id, user_id, gender, age, city, state, country, membership_type,
                    total_spend, prior_purchases, satisfaction_level
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO NOTHING
                """,
                profile_rows,
            )
            cursor.executemany(
                """
                INSERT INTO products (
                    id, store_id, category_id, sku, title, description, brand, currency, source_country,
                    unit_price, discount_percentage, stock_quantity, total_sales, is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET store_id = EXCLUDED.store_id,
                    category_id = EXCLUDED.category_id,
                    sku = EXCLUDED.sku,
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    brand = EXCLUDED.brand,
                    currency = EXCLUDED.currency,
                    source_country = EXCLUDED.source_country,
                    unit_price = EXCLUDED.unit_price,
                    discount_percentage = EXCLUDED.discount_percentage,
                    stock_quantity = EXCLUDED.stock_quantity,
                    total_sales = EXCLUDED.total_sales,
                    is_active = EXCLUDED.is_active
                """,
                product_rows,
            )
            cursor.executemany(
                """
                INSERT INTO source_product_map (id, source_system, source_product_id, product_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (source_system, source_product_id) DO NOTHING
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
                ON CONFLICT (id) DO NOTHING
                """,
                order_rows,
            )
            cursor.executemany(
                """
                INSERT INTO source_order_map (id, source_system, source_order_id, order_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (source_system, source_order_id) DO NOTHING
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
                ON CONFLICT (id) DO NOTHING
                """,
                order_item_rows,
            )

    print(
        f"Pakistan load complete: customers={len(user_rows)}, "
        f"products={len(product_rows)}, orders={len(order_rows)}, order_items={len(order_item_rows)}"
    )


if __name__ == "__main__":
    main()
