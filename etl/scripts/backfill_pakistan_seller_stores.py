from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from config import STAGING_DIR
from db import get_connection
from load_core_phase1 import PAKISTAN_STORE_NAME, SYSTEM_ADMIN_PASSWORD_HASH, _deterministic_id
from load_core_phase2 import (
    _mode_or_first,
    _normalize_pakistan_category_name,
    _normalize_pakistan_seller_code,
    _pakistan_seller_email,
    _pakistan_store_product_id,
    _pakistan_store_product_sku,
    _pakistan_synthetic_seller_code,
    _pakistan_synthetic_seller_count,
    _pakistan_synthetic_seller_email,
    _pakistan_synthetic_seller_index,
    _pakistan_synthetic_store_name,
)


@dataclass(frozen=True)
class BackfillSummary:
    seller_users: int
    seller_user_roles: int
    stores: int
    orders_updated: int
    synthetic_seller_users: int
    synthetic_user_roles: int
    synthetic_stores: int
    synthetic_orders_updated: int
    product_copies: int
    order_items_updated: int
    stale_stores_deleted: int
    stale_users_deleted: int


def _load_seller_codes() -> list[str]:
    pakistan = pd.read_csv(STAGING_DIR / "pakistan_staging.csv", usecols=["sales_commission_code"], dtype=str)
    seller_codes = {
        code
        for code in pakistan["sales_commission_code"].map(_normalize_pakistan_seller_code)
        if code is not None
    }
    return sorted(seller_codes)


def _load_synthetic_category_seller_counts() -> dict[str, int]:
    pakistan = pd.read_csv(
        STAGING_DIR / "pakistan_staging.csv",
        usecols=["order_id", "sales_commission_code", "category_name"],
        dtype={"order_id": str, "sales_commission_code": str, "category_name": str},
    )
    pakistan["seller_code"] = pakistan["sales_commission_code"].map(_normalize_pakistan_seller_code)
    unassigned = pakistan.loc[pakistan["seller_code"].isna()].copy()
    unassigned["category_name"] = unassigned["category_name"].map(_normalize_pakistan_category_name)
    primary_categories = unassigned.groupby("order_id")["category_name"].agg(_mode_or_first)
    return {
        category_name: _pakistan_synthetic_seller_count(int(order_count))
        for category_name, order_count in primary_categories.value_counts().items()
    }


def backfill_pakistan_seller_stores() -> BackfillSummary:
    seller_codes = _load_seller_codes()
    synthetic_category_seller_counts = _load_synthetic_category_seller_counts()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            seller_users = 0
            seller_user_roles = 0
            stores = 0
            synthetic_seller_users = 0
            synthetic_user_roles = 0
            synthetic_stores = 0

            for seller_code in seller_codes:
                seller_user_id = _deterministic_id("user", f"PAKISTAN_SELLER:{seller_code}")
                store_id = _deterministic_id("store", f"PAKISTAN:{seller_code}")
                seller_email = _pakistan_seller_email(seller_code)

                cursor.execute(
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
                    (
                        seller_user_id,
                        seller_email,
                        SYSTEM_ADMIN_PASSWORD_HASH,
                        False,
                        True,
                        "Pakistan Seller",
                        seller_code,
                    ),
                )
                seller_users += 1

                cursor.execute(
                    """
                    INSERT INTO user_roles (id, user_id, role_type, is_active_role)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id, role_type) DO UPDATE
                    SET is_active_role = EXCLUDED.is_active_role
                    """,
                    (
                        _deterministic_id("role", f"{seller_user_id}:CORPORATE"),
                        seller_user_id,
                        "CORPORATE",
                        True,
                    ),
                )
                seller_user_roles += 1

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
                    (
                        store_id,
                        seller_user_id,
                        f"PAKISTAN_SELLER_{seller_code}",
                        "OPEN",
                        seller_email,
                    ),
                )
                stores += 1

            for category_name, seller_count in sorted(synthetic_category_seller_counts.items()):
                for index in range(seller_count):
                    seller_code = _pakistan_synthetic_seller_code(category_name, index)
                    seller_user_id = _deterministic_id("user", f"PAKISTAN_SYNTHETIC_SELLER:{seller_code}")
                    store_id = _deterministic_id("store", f"PAKISTAN_SYNTHETIC:{seller_code}")
                    seller_email = _pakistan_synthetic_seller_email(seller_code)

                    cursor.execute(
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
                        (
                            seller_user_id,
                            seller_email,
                            SYSTEM_ADMIN_PASSWORD_HASH,
                            False,
                            True,
                            "Pakistan Synthetic Seller",
                            seller_code,
                        ),
                    )
                    synthetic_seller_users += 1

                    cursor.execute(
                        """
                        INSERT INTO user_roles (id, user_id, role_type, is_active_role)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (user_id, role_type) DO UPDATE
                        SET is_active_role = EXCLUDED.is_active_role
                        """,
                        (
                            _deterministic_id("role", f"{seller_user_id}:CORPORATE"),
                            seller_user_id,
                            "CORPORATE",
                            True,
                        ),
                    )
                    synthetic_user_roles += 1

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
                        (
                            store_id,
                            seller_user_id,
                            _pakistan_synthetic_store_name(category_name, index),
                            "OPEN",
                            seller_email,
                        ),
                    )
                    synthetic_stores += 1

            cursor.execute(
                """
                CREATE TEMP TABLE tmp_pakistan_order_store (
                    source_order_id VARCHAR(100) PRIMARY KEY,
                    store_id UUID NOT NULL
                ) ON COMMIT DROP
                """
            )

            order_store_rows = []
            pakistan = pd.read_csv(
                STAGING_DIR / "pakistan_staging.csv",
                usecols=["order_id", "sales_commission_code", "category_name"],
                dtype={"order_id": str, "sales_commission_code": str, "category_name": str},
            )
            pakistan["seller_code"] = pakistan["sales_commission_code"].map(_normalize_pakistan_seller_code)
            real_seller_orders = pakistan.dropna(subset=["seller_code"]).drop_duplicates(subset=["order_id"])
            for row in real_seller_orders.itertuples(index=False):
                order_store_rows.append((row.order_id, _deterministic_id("store", f"PAKISTAN:{row.seller_code}")))

            unassigned = pakistan.loc[pakistan["seller_code"].isna()].copy()
            unassigned["category_name"] = unassigned["category_name"].map(_normalize_pakistan_category_name)
            synthetic_orders = (
                unassigned.groupby("order_id", as_index=False)
                .agg(category_name=("category_name", _mode_or_first))
            )
            for row in synthetic_orders.itertuples(index=False):
                category_name = _normalize_pakistan_category_name(row.category_name)
                seller_count = synthetic_category_seller_counts.get(category_name, 1)
                seller_index = _pakistan_synthetic_seller_index(row.order_id, seller_count)
                seller_code = _pakistan_synthetic_seller_code(category_name, seller_index)
                order_store_rows.append((row.order_id, _deterministic_id("store", f"PAKISTAN_SYNTHETIC:{seller_code}")))

            cursor.executemany(
                """
                INSERT INTO tmp_pakistan_order_store (source_order_id, store_id)
                VALUES (%s, %s)
                ON CONFLICT (source_order_id) DO NOTHING
                """,
                order_store_rows,
            )

            cursor.execute(
                """
                UPDATE orders o
                SET store_id = t.store_id
                FROM source_order_map som
                JOIN tmp_pakistan_order_store t ON t.source_order_id = som.source_order_id
                WHERE som.source_system = 'PAKISTAN'
                  AND som.order_id = o.id
                  AND o.store_id <> t.store_id
                """
            )
            orders_updated = cursor.rowcount
            synthetic_orders_updated = len(synthetic_orders)

            cursor.execute(
                """
                CREATE TEMP TABLE tmp_pakistan_product_store (
                    source_product_id VARCHAR(255) NOT NULL,
                    store_id UUID NOT NULL,
                    product_id UUID NOT NULL,
                    PRIMARY KEY (source_product_id, store_id)
                ) ON COMMIT DROP
                """
            )
            cursor.execute(
                """
                SELECT DISTINCT
                    spm.source_product_id,
                    o.store_id,
                    p.category_id,
                    p.title,
                    p.description,
                    p.brand,
                    p.image_urls,
                    p.unit_price,
                    p.discount_percentage,
                    p.cost_of_product,
                    p.stock_quantity,
                    p.tags,
                    p.avg_rating,
                    p.review_count,
                    p.is_active,
                    p.currency,
                    p.source_country
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN products p ON p.id = oi.product_id
                JOIN source_order_map som ON som.order_id = o.id AND som.source_system = 'PAKISTAN'
                JOIN source_product_map spm ON spm.product_id = p.id AND spm.source_system = 'PAKISTAN'
                WHERE o.store_id <> p.store_id
                """
            )
            product_copy_source_rows = cursor.fetchall()
            product_copy_rows = []
            temp_product_rows = []
            for row in product_copy_source_rows:
                (
                    source_product_id,
                    store_id,
                    category_id,
                    title,
                    description,
                    brand,
                    image_urls,
                    unit_price,
                    discount_percentage,
                    cost_of_product,
                    stock_quantity,
                    tags,
                    avg_rating,
                    review_count,
                    is_active,
                    currency,
                    source_country,
                ) = row
                product_id = _pakistan_store_product_id(source_product_id, str(store_id))
                product_copy_rows.append(
                    (
                        product_id,
                        store_id,
                        category_id,
                        _pakistan_store_product_sku(source_product_id, str(store_id)),
                        title,
                        description,
                        brand,
                        image_urls,
                        unit_price,
                        discount_percentage,
                        cost_of_product,
                        stock_quantity,
                        tags,
                        avg_rating,
                        review_count,
                        0,
                        is_active,
                        currency,
                        source_country,
                    )
                )
                temp_product_rows.append((source_product_id, store_id, product_id))

            cursor.executemany(
                """
                INSERT INTO tmp_pakistan_product_store (source_product_id, store_id, product_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (source_product_id, store_id) DO NOTHING
                """,
                temp_product_rows,
            )
            cursor.executemany(
                """
                INSERT INTO products (
                    id, store_id, category_id, sku, title, description, brand, image_urls,
                    unit_price, discount_percentage, cost_of_product, stock_quantity, tags,
                    avg_rating, review_count, total_sales, is_active, currency, source_country
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET store_id = EXCLUDED.store_id,
                    category_id = EXCLUDED.category_id,
                    sku = EXCLUDED.sku,
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    brand = EXCLUDED.brand,
                    image_urls = EXCLUDED.image_urls,
                    unit_price = EXCLUDED.unit_price,
                    discount_percentage = EXCLUDED.discount_percentage,
                    cost_of_product = EXCLUDED.cost_of_product,
                    stock_quantity = EXCLUDED.stock_quantity,
                    tags = EXCLUDED.tags,
                    avg_rating = EXCLUDED.avg_rating,
                    review_count = EXCLUDED.review_count,
                    is_active = EXCLUDED.is_active,
                    currency = EXCLUDED.currency,
                    source_country = EXCLUDED.source_country
                """,
                product_copy_rows,
            )
            product_copies = len(product_copy_rows)

            cursor.execute(
                """
                UPDATE order_items oi
                SET product_id = t.product_id
                FROM orders o, products p, source_order_map som, source_product_map spm, tmp_pakistan_product_store t
                WHERE oi.order_id = o.id
                  AND p.id = oi.product_id
                  AND som.order_id = o.id
                  AND som.source_system = 'PAKISTAN'
                  AND spm.product_id = p.id
                  AND spm.source_system = 'PAKISTAN'
                  AND t.source_product_id = spm.source_product_id
                  AND t.store_id = o.store_id
                  AND o.store_id <> p.store_id
                """
            )
            order_items_updated = cursor.rowcount

            cursor.execute(
                """
                UPDATE products p
                SET total_sales = sales.total_quantity
                FROM (
                    SELECT oi.product_id, SUM(oi.quantity)::INT AS total_quantity
                    FROM order_items oi
                    JOIN tmp_pakistan_product_store t ON t.product_id = oi.product_id
                    GROUP BY oi.product_id
                ) sales
                WHERE p.id = sales.product_id
                """
            )

            cursor.execute(
                """
                CREATE TEMP TABLE tmp_pakistan_valid_store (
                    store_id UUID PRIMARY KEY
                ) ON COMMIT DROP
                """
            )
            cursor.executemany(
                """
                INSERT INTO tmp_pakistan_valid_store (store_id)
                VALUES (%s)
                ON CONFLICT (store_id) DO NOTHING
                """,
                [(_deterministic_id("store", f"PAKISTAN:{seller_code}"),) for seller_code in seller_codes],
            )
            synthetic_valid_store_rows = []
            for category_name, seller_count in synthetic_category_seller_counts.items():
                for index in range(seller_count):
                    seller_code = _pakistan_synthetic_seller_code(category_name, index)
                    synthetic_valid_store_rows.append((_deterministic_id("store", f"PAKISTAN_SYNTHETIC:{seller_code}"),))
            cursor.executemany(
                """
                INSERT INTO tmp_pakistan_valid_store (store_id)
                VALUES (%s)
                ON CONFLICT (store_id) DO NOTHING
                """,
                synthetic_valid_store_rows,
            )

            cursor.execute(
                """
                CREATE TEMP TABLE tmp_deleted_pakistan_store_owner (
                    owner_id UUID PRIMARY KEY
                ) ON COMMIT DROP
                """
            )
            cursor.execute(
                """
                WITH deleted_stores AS (
                    DELETE FROM stores s
                    USING users u
                    WHERE u.id = s.owner_id
                      AND (
                          u.email LIKE 'pakistan-seller-%@pakistan.etl.local'
                          OR u.email LIKE 'pakistan-synthetic-%@pakistan.etl.local'
                      )
                      AND NOT EXISTS (
                          SELECT 1
                          FROM tmp_pakistan_valid_store valid_store
                          WHERE valid_store.store_id = s.id
                      )
                      AND NOT EXISTS (
                          SELECT 1
                          FROM orders o
                          WHERE o.store_id = s.id
                      )
                    RETURNING s.owner_id
                )
                INSERT INTO tmp_deleted_pakistan_store_owner (owner_id)
                SELECT DISTINCT owner_id
                FROM deleted_stores
                ON CONFLICT (owner_id) DO NOTHING
                """
            )
            stale_stores_deleted = cursor.rowcount

            cursor.execute(
                """
                DELETE FROM user_roles ur
                USING tmp_deleted_pakistan_store_owner deleted_owner
                WHERE ur.user_id = deleted_owner.owner_id
                  AND ur.role_type = 'CORPORATE'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM stores s
                      WHERE s.owner_id = ur.user_id
                  )
                """
            )
            cursor.execute(
                """
                DELETE FROM users u
                USING tmp_deleted_pakistan_store_owner deleted_owner
                WHERE u.id = deleted_owner.owner_id
                  AND u.email LIKE 'pakistan-seller-%@pakistan.etl.local'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM stores s
                      WHERE s.owner_id = u.id
                  )
                """
            )
            stale_users_deleted = cursor.rowcount

    return BackfillSummary(
        seller_users=seller_users,
        seller_user_roles=seller_user_roles,
        stores=stores,
        orders_updated=orders_updated,
        synthetic_seller_users=synthetic_seller_users,
        synthetic_user_roles=synthetic_user_roles,
        synthetic_stores=synthetic_stores,
        synthetic_orders_updated=synthetic_orders_updated,
        product_copies=product_copies,
        order_items_updated=order_items_updated,
        stale_stores_deleted=stale_stores_deleted,
        stale_users_deleted=stale_users_deleted,
    )


def main() -> None:
    summary = backfill_pakistan_seller_stores()
    print(
        "Pakistan seller store backfill complete: "
        f"seller_users={summary.seller_users}, "
        f"seller_user_roles={summary.seller_user_roles}, "
        f"stores={summary.stores}, "
        f"orders_updated={summary.orders_updated}, "
        f"synthetic_seller_users={summary.synthetic_seller_users}, "
        f"synthetic_user_roles={summary.synthetic_user_roles}, "
        f"synthetic_stores={summary.synthetic_stores}, "
        f"synthetic_orders_updated={summary.synthetic_orders_updated}, "
        f"product_copies={summary.product_copies}, "
        f"order_items_updated={summary.order_items_updated}, "
        f"stale_stores_deleted={summary.stale_stores_deleted}, "
        f"stale_users_deleted={summary.stale_users_deleted}"
    )


if __name__ == "__main__":
    main()
