from __future__ import annotations

from hashlib import md5

from db import get_connection


GENDER_FEMALE_THRESHOLD = 58

AGE_BUCKETS = (
    (12, 18, 24),
    (24, 25, 29),
    (30, 30, 34),
    (20, 35, 44),
    (12, 45, 55),
    (2, 56, 65),
)

CITY_STATE_FALLBACKS: dict[str, list[tuple[str, str]]] = {
    "Pakistan": [
        ("Karachi", "Sindh"),
        ("Lahore", "Punjab"),
        ("Islamabad", "Islamabad Capital Territory"),
        ("Rawalpindi", "Punjab"),
        ("Faisalabad", "Punjab"),
    ],
    "United Kingdom": [
        ("London", "England"),
        ("Manchester", "England"),
        ("Birmingham", "England"),
        ("Glasgow", "Scotland"),
        ("Leeds", "England"),
    ],
    "Germany": [
        ("Berlin", "Berlin"),
        ("Munich", "Bavaria"),
        ("Hamburg", "Hamburg"),
        ("Frankfurt", "Hesse"),
    ],
    "France": [
        ("Paris", "Ile-de-France"),
        ("Lyon", "Auvergne-Rhone-Alpes"),
        ("Marseille", "Provence-Alpes-Cote d'Azur"),
    ],
    "Spain": [
        ("Madrid", "Community of Madrid"),
        ("Barcelona", "Catalonia"),
        ("Valencia", "Valencia"),
    ],
    "Belgium": [
        ("Brussels", "Brussels-Capital Region"),
        ("Antwerp", "Flanders"),
        ("Ghent", "Flanders"),
    ],
    "Switzerland": [
        ("Zurich", "Zurich"),
        ("Geneva", "Geneva"),
        ("Basel", "Basel-Stadt"),
    ],
    "EIRE": [
        ("Dublin", "Leinster"),
        ("Cork", "Munster"),
        ("Galway", "Connacht"),
    ],
}


def deterministic_percent(user_id: str, salt: str) -> int:
    digest = md5(f"{user_id}:{salt}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def deterministic_index(user_id: str, salt: str, size: int) -> int:
    digest = md5(f"{user_id}:{salt}".encode("utf-8")).hexdigest()
    return int(digest[8:16], 16) % size


def deterministic_gender(user_id: str) -> str:
    return "Female" if deterministic_percent(user_id, "gender") < GENDER_FEMALE_THRESHOLD else "Male"


def deterministic_age(user_id: str) -> int:
    roll = deterministic_percent(user_id, "age-bucket")
    cumulative = 0
    for weight, start, end in AGE_BUCKETS:
        cumulative += weight
        if roll < cumulative:
            span = end - start + 1
            return start + deterministic_index(user_id, "age-value", span)
    return 30


def backfill_city_and_state_from_orders(cur) -> None:
    cur.execute(
        """
        WITH ranked_city AS (
            SELECT
                user_id,
                shipping_city,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id
                    ORDER BY COUNT(*) DESC, MAX(order_date) DESC, shipping_city ASC
                ) AS rn
            FROM orders
            WHERE shipping_city IS NOT NULL AND btrim(shipping_city) <> ''
            GROUP BY user_id, shipping_city
        )
        UPDATE customer_profiles cp
        SET city = rc.shipping_city
        FROM ranked_city rc
        WHERE cp.user_id = rc.user_id
          AND rc.rn = 1
          AND (cp.city IS NULL OR btrim(cp.city) = '')
        """
    )

    cur.execute(
        """
        WITH ranked_state AS (
            SELECT
                user_id,
                shipping_state,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id
                    ORDER BY COUNT(*) DESC, MAX(order_date) DESC, shipping_state ASC
                ) AS rn
            FROM orders
            WHERE shipping_state IS NOT NULL AND btrim(shipping_state) <> ''
            GROUP BY user_id, shipping_state
        )
        UPDATE customer_profiles cp
        SET state = rs.shipping_state
        FROM ranked_state rs
        WHERE cp.user_id = rs.user_id
          AND rs.rn = 1
          AND (cp.state IS NULL OR btrim(cp.state) = '')
        """
    )

    cur.execute(
        """
        WITH ranked_country_city AS (
            SELECT
                shipping_country,
                shipping_city,
                ROW_NUMBER() OVER (
                    PARTITION BY shipping_country
                    ORDER BY COUNT(*) DESC, MAX(order_date) DESC, shipping_city ASC
                ) AS rn
            FROM orders
            WHERE shipping_country IS NOT NULL
              AND btrim(shipping_country) <> ''
              AND shipping_city IS NOT NULL
              AND btrim(shipping_city) <> ''
            GROUP BY shipping_country, shipping_city
        )
        UPDATE customer_profiles cp
        SET city = rcc.shipping_city
        FROM ranked_country_city rcc
        WHERE cp.country = rcc.shipping_country
          AND rcc.rn = 1
          AND (cp.city IS NULL OR btrim(cp.city) = '')
        """
    )

    cur.execute(
        """
        WITH ranked_country_state AS (
            SELECT
                shipping_country,
                shipping_state,
                ROW_NUMBER() OVER (
                    PARTITION BY shipping_country
                    ORDER BY COUNT(*) DESC, MAX(order_date) DESC, shipping_state ASC
                ) AS rn
            FROM orders
            WHERE shipping_country IS NOT NULL
              AND btrim(shipping_country) <> ''
              AND shipping_state IS NOT NULL
              AND btrim(shipping_state) <> ''
            GROUP BY shipping_country, shipping_state
        )
        UPDATE customer_profiles cp
        SET state = rcs.shipping_state
        FROM ranked_country_state rcs
        WHERE cp.country = rcs.shipping_country
          AND rcs.rn = 1
          AND (cp.state IS NULL OR btrim(cp.state) = '')
        """
    )


def synthetic_fill_city_and_state(cur) -> int:
    cur.execute(
        """
        SELECT user_id, country, city, state
        FROM customer_profiles
        WHERE (city IS NULL OR btrim(city) = '' OR state IS NULL OR btrim(state) = '')
          AND country IS NOT NULL
          AND btrim(country) <> ''
        """
    )
    rows = cur.fetchall()
    updates: list[tuple[str, str | None, str | None]] = []
    for user_id, country, city, state in rows:
        choices = CITY_STATE_FALLBACKS.get(country)
        if not choices:
            continue
        chosen_city, chosen_state = choices[deterministic_index(str(user_id), "city-state", len(choices))]
        target_city = city if city and str(city).strip() else chosen_city
        target_state = state if state and str(state).strip() else chosen_state
        updates.append((target_city, target_state, str(user_id)))

    if updates:
        cur.executemany(
            """
            UPDATE customer_profiles
            SET city = %s,
                state = %s
            WHERE user_id = %s
            """,
            updates,
        )
    return len(updates)


def fill_gender_and_age(cur) -> tuple[int, int]:
    cur.execute(
        """
        SELECT user_id, gender, age
        FROM customer_profiles
        WHERE gender IS NULL OR btrim(gender) = '' OR age IS NULL
        """
    )
    rows = cur.fetchall()
    updates: list[tuple[str, int, str]] = []
    gender_count = 0
    age_count = 0
    for user_id, gender, age in rows:
        target_gender = gender if gender and str(gender).strip() else deterministic_gender(str(user_id))
        target_age = age if age is not None else deterministic_age(str(user_id))
        if (gender if gender and str(gender).strip() else None) is None:
            gender_count += 1
        if age is None:
            age_count += 1
        updates.append((target_gender, target_age, str(user_id)))

    if updates:
        cur.executemany(
            """
            UPDATE customer_profiles
            SET gender = %s,
                age = %s
            WHERE user_id = %s
            """,
            updates,
        )
    return gender_count, age_count


def print_summary(cur, label: str) -> None:
    cur.execute(
        """
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE gender IS NULL OR btrim(gender) = '') AS gender_missing,
          COUNT(*) FILTER (WHERE age IS NULL) AS age_missing,
          COUNT(*) FILTER (WHERE city IS NULL OR btrim(city) = '') AS city_missing,
          COUNT(*) FILTER (WHERE state IS NULL OR btrim(state) = '') AS state_missing
        FROM customer_profiles
        """
    )
    print(label, cur.fetchone())


def main() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            print_summary(cur, "before")
            backfill_city_and_state_from_orders(cur)
            city_state_fallback_count = synthetic_fill_city_and_state(cur)
            gender_count, age_count = fill_gender_and_age(cur)
            print(f"synthetic city/state updates: {city_state_fallback_count}")
            print(f"gender updates: {gender_count}")
            print(f"age updates: {age_count}")
            print_summary(cur, "after")


if __name__ == "__main__":
    main()
