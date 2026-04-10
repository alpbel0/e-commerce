from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid5

import pandas as pd

from config import LOG_DIR, MAPPINGS_DIR, STAGING_DIR, UUID_NAMESPACE
from db import get_connection
from utils import append_run_log, ensure_directory


SYSTEM_ADMIN_EMAIL = "system@local.etl"
SYSTEM_ADMIN_PASSWORD_HASH = "etl-system-admin"
ONLINE_RETAIL_STORE_NAME = "ONLINE_RETAIL_STORE"
PAKISTAN_STORE_NAME = "PAKISTAN_STORE"
UNCATEGORIZED_SLUG = "uncategorized"


@dataclass(frozen=True)
class LoadSummary:
    users: int
    user_roles: int
    customer_profiles: int
    source_customer_map: int
    stores: int
    categories: int


@dataclass
class ProfileSeed:
    user_id: str
    gender: str | None = None
    age: int | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    membership_type: str | None = None
    total_spend: float = 0.0
    prior_purchases: int = 0
    satisfaction_level: int | None = None


def _deterministic_id(entity_type: str, source_key: str) -> str:
    return str(uuid5(UUID_NAMESPACE, f"{entity_type}:{source_key}"))


def _split_name(display_name: str | None, fallback_source_id: str) -> tuple[str, str]:
    if display_name and display_name.strip():
        parts = display_name.strip().split()
        if len(parts) == 1:
            return parts[0], fallback_source_id
        return parts[0], " ".join(parts[1:])
    return "Customer", fallback_source_id


def _build_name_lookup() -> dict[tuple[str, str], tuple[str, str]]:
    amazon_staging = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"customer_id": str})
    amazon_names = (
        amazon_staging[["source_system", "customer_id", "customer_name"]]
        .dropna(subset=["customer_id"])
        .drop_duplicates(subset=["source_system", "customer_id"])
    )

    name_lookup: dict[tuple[str, str], tuple[str, str]] = {}
    for row in amazon_names.itertuples(index=False):
        source_customer_id = str(row.customer_id)
        name_lookup[(row.source_system, source_customer_id)] = _split_name(
            row.customer_name if pd.notna(row.customer_name) else None,
            source_customer_id,
        )
    return name_lookup


def _build_user_rows(customer_map: pd.DataFrame) -> list[tuple]:
    name_lookup = _build_name_lookup()
    rows: list[tuple] = []
    for row in customer_map.itertuples(index=False):
        email = f"{row.source_system.lower()}_{row.source_customer_id}@etl.local".lower()
        first_name, last_name = name_lookup.get(
            (row.source_system, row.source_customer_id),
            _split_name(None, row.source_customer_id),
        )
        rows.append((row.user_id, email, SYSTEM_ADMIN_PASSWORD_HASH, False, True, first_name, last_name))
    return rows


def _build_customer_profile_rows() -> list[tuple]:
    customer_map = pd.read_csv(MAPPINGS_DIR / "source_customer_map.csv", dtype=str)
    profiles: dict[str, ProfileSeed] = {}

    customer_behavior = pd.read_csv(STAGING_DIR / "customer_behavior_staging.csv", dtype={"customer_id": str})
    behavior_map = customer_map.loc[customer_map["source_system"] == "CUSTOMER_BEHAVIOR"].copy()
    behavior_map = behavior_map.rename(columns={"source_customer_id": "customer_id"})
    merged_behavior = customer_behavior.merge(behavior_map, on=["source_system", "customer_id"], how="inner")
    merged_behavior = merged_behavior.drop_duplicates(subset=["user_id"])

    for row in merged_behavior.itertuples(index=False):
        profiles[row.user_id] = ProfileSeed(
            user_id=row.user_id,
            gender=row.gender if pd.notna(row.gender) else None,
            age=int(row.age) if pd.notna(row.age) else None,
            city=row.city if pd.notna(row.city) else None,
            membership_type=row.membership_type if pd.notna(row.membership_type) else None,
            total_spend=float(row.total_spend) if pd.notna(row.total_spend) else 0.0,
            prior_purchases=int(row.items_purchased) if pd.notna(row.items_purchased) else 0,
            satisfaction_level=int(row.satisfaction_level) if pd.notna(row.satisfaction_level) else None,
        )

    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"customer_id": str})
    amazon = (
        amazon[["source_system", "customer_id", "city", "state", "country"]]
        .dropna(subset=["customer_id"])
        .drop_duplicates(subset=["source_system", "customer_id"])
    )
    amazon_map = customer_map.loc[customer_map["source_system"] == "AMAZON"].copy()
    amazon_map = amazon_map.rename(columns={"source_customer_id": "customer_id"})
    merged_amazon = amazon.merge(amazon_map, on=["source_system", "customer_id"], how="inner")

    for row in merged_amazon.itertuples(index=False):
        profile = profiles.get(row.user_id, ProfileSeed(user_id=row.user_id))
        profile.city = profile.city or (row.city if pd.notna(row.city) else None)
        profile.state = profile.state or (row.state if pd.notna(row.state) else None)
        profile.country = profile.country or (row.country if pd.notna(row.country) else None)
        profiles[row.user_id] = profile

    online_retail = pd.read_csv(STAGING_DIR / "online_retail_staging.csv", dtype={"customer_id": str})
    online_retail = (
        online_retail[["source_system", "customer_id", "country"]]
        .dropna(subset=["customer_id"])
        .drop_duplicates(subset=["source_system", "customer_id"])
    )
    online_retail_map = customer_map.loc[customer_map["source_system"] == "ONLINE_RETAIL"].copy()
    online_retail_map = online_retail_map.rename(columns={"source_customer_id": "customer_id"})
    merged_online_retail = online_retail.merge(online_retail_map, on=["source_system", "customer_id"], how="inner")

    for row in merged_online_retail.itertuples(index=False):
        profile = profiles.get(row.user_id, ProfileSeed(user_id=row.user_id))
        profile.country = profile.country or (row.country if pd.notna(row.country) else None)
        profiles[row.user_id] = profile

    rows: list[tuple] = []
    for profile in profiles.values():
        profile_id = _deterministic_id("customer_profile", profile.user_id)
        rows.append(
            (
                profile_id,
                profile.user_id,
                profile.gender,
                profile.age,
                profile.city,
                profile.state,
                profile.country,
                profile.membership_type,
                profile.total_spend,
                profile.prior_purchases,
                profile.satisfaction_level,
            )
        )
    return rows


def _load_frames() -> tuple[pd.DataFrame, pd.DataFrame]:
    customer_map = pd.read_csv(MAPPINGS_DIR / "source_customer_map.csv", dtype=str)
    customer_map = customer_map.drop_duplicates(subset=["source_system", "source_customer_id"])
    customer_profiles = pd.read_csv(STAGING_DIR / "customer_behavior_staging.csv")
    return customer_map, customer_profiles


def load_phase_1_master_data() -> LoadSummary:
    customer_map, _ = _load_frames()
    user_rows = _build_user_rows(customer_map)
    customer_profile_rows = _build_customer_profile_rows()

    system_admin_id = _deterministic_id("user", SYSTEM_ADMIN_EMAIL)
    online_retail_store_id = _deterministic_id("store", ONLINE_RETAIL_STORE_NAME)
    pakistan_store_id = _deterministic_id("store", PAKISTAN_STORE_NAME)
    uncategorized_category_id = _deterministic_id("category", UNCATEGORIZED_SLUG)

    ensure_directory(LOG_DIR)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE customer_profiles, user_roles, source_customer_map, categories, stores, users RESTART IDENTITY CASCADE")

            cursor.execute(
                """
                INSERT INTO users (id, email, password_hash, email_verified, is_active, first_name, last_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (system_admin_id, SYSTEM_ADMIN_EMAIL, SYSTEM_ADMIN_PASSWORD_HASH, True, True, "System", "Administrator"),
            )

            cursor.execute(
                """
                INSERT INTO user_roles (id, user_id, role_type, is_active_role)
                VALUES (%s, %s, %s, %s)
                """,
                (_deterministic_id("role", f"{system_admin_id}:ADMIN"), system_admin_id, "ADMIN", True),
            )

            cursor.executemany(
                """
                INSERT INTO users (id, email, password_hash, email_verified, is_active, first_name, last_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                user_rows,
            )

            imported_role_rows = [
                (_deterministic_id("role", f"{row[0]}:INDIVIDUAL"), row[0], "INDIVIDUAL", True)
                for row in user_rows
            ]
            cursor.executemany(
                """
                INSERT INTO user_roles (id, user_id, role_type, is_active_role)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, role_type) DO NOTHING
                """,
                imported_role_rows,
            )

            source_customer_rows = [
                (_deterministic_id("source_customer_map", f"{row.source_system}:{row.source_customer_id}"), row.source_system, row.source_customer_id, row.user_id)
                for row in customer_map.itertuples(index=False)
            ]
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
                customer_profile_rows,
            )

            cursor.executemany(
                """
                INSERT INTO stores (id, owner_id, name, status, contact_email)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                [
                    (online_retail_store_id, system_admin_id, ONLINE_RETAIL_STORE_NAME, "OPEN", SYSTEM_ADMIN_EMAIL),
                    (pakistan_store_id, system_admin_id, PAKISTAN_STORE_NAME, "OPEN", SYSTEM_ADMIN_EMAIL),
                ],
            )

            cursor.execute(
                """
                INSERT INTO categories (id, name, slug, parent_id, level, is_active)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (slug) DO NOTHING
                """,
                (uncategorized_category_id, "UNCATEGORIZED", UNCATEGORIZED_SLUG, None, 0, True),
            )

    summary = LoadSummary(
        users=len(user_rows) + 1,
        user_roles=len(user_rows) + 1,
        customer_profiles=len(customer_profile_rows),
        source_customer_map=len(customer_map),
        stores=2,
        categories=1,
    )
    append_run_log(
        [
            "phase=4",
            "step=load_master_data",
            f"users={summary.users}",
            f"user_roles={summary.user_roles}",
            f"customer_profiles={summary.customer_profiles}",
            f"source_customer_map={summary.source_customer_map}",
            f"stores={summary.stores}",
            f"categories={summary.categories}",
        ]
    )
    return summary


def main() -> None:
    summary = load_phase_1_master_data()
    print(
        "PHASE 4 MASTER LOAD: "
        f"users={summary.users}, "
        f"user_roles={summary.user_roles}, "
        f"customer_profiles={summary.customer_profiles}, "
        f"source_customer_map={summary.source_customer_map}, "
        f"stores={summary.stores}, "
        f"categories={summary.categories}"
    )


if __name__ == "__main__":
    main()
