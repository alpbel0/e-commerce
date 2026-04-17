from __future__ import annotations

from dataclasses import dataclass

from db import get_connection
from load_core_phase1 import SYSTEM_ADMIN_PASSWORD_HASH, _deterministic_id


@dataclass(frozen=True)
class BackfillSummary:
    seller_users: int
    seller_user_roles: int
    stores_updated: int


def _seller_id_from_store_name(store_name: str) -> str:
    return store_name.removeprefix("AMAZON_STORE_")


def backfill_amazon_seller_corporate_users() -> BackfillSummary:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, contact_email
                FROM stores
                WHERE name LIKE 'AMAZON_STORE_%'
                ORDER BY name
                """
            )
            store_rows = cursor.fetchall()

            seller_users = 0
            seller_user_roles = 0
            stores_updated = 0

            for store_id, store_name, contact_email in store_rows:
                seller_id = _seller_id_from_store_name(store_name)
                seller_email = contact_email or f"{seller_id.lower()}@amazon.etl.local"
                deterministic_user_id = _deterministic_id("user", f"AMAZON_SELLER:{seller_id}")

                cursor.execute(
                    """
                    INSERT INTO users (id, email, password_hash, email_verified, is_active, first_name, last_name)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (email) DO UPDATE
                    SET password_hash = EXCLUDED.password_hash,
                        email_verified = EXCLUDED.email_verified,
                        is_active = EXCLUDED.is_active,
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name
                    RETURNING id
                    """,
                    (
                        deterministic_user_id,
                        seller_email,
                        SYSTEM_ADMIN_PASSWORD_HASH,
                        False,
                        True,
                        "Amazon Seller",
                        seller_id,
                    ),
                )
                seller_user_id = cursor.fetchone()[0]
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
                seller_user_roles += cursor.rowcount

                cursor.execute(
                    """
                    UPDATE stores
                    SET owner_id = %s
                    WHERE id = %s AND owner_id <> %s
                    """,
                    (seller_user_id, store_id, seller_user_id),
                )
                stores_updated += cursor.rowcount

    return BackfillSummary(
        seller_users=seller_users,
        seller_user_roles=seller_user_roles,
        stores_updated=stores_updated,
    )


def main() -> None:
    summary = backfill_amazon_seller_corporate_users()
    print(
        "Amazon seller corporate backfill complete: "
        f"seller_users={summary.seller_users}, "
        f"seller_user_roles={summary.seller_user_roles}, "
        f"stores_updated={summary.stores_updated}"
    )


if __name__ == "__main__":
    main()
