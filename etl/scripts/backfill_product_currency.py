from __future__ import annotations

import pandas as pd

from config import MAPPINGS_DIR, STAGING_DIR
from db import get_connection
from load_core_phase1 import ONLINE_RETAIL_STORE_NAME, PAKISTAN_STORE_NAME
from load_core_phase2 import AMAZON_SOURCE, country_to_currency


def build_amazon_product_currency_map() -> dict[str, tuple[str, str | None]]:
    source_product_map = pd.read_csv(MAPPINGS_DIR / "source_product_map.csv", dtype=str)
    amazon = pd.read_csv(STAGING_DIR / "amazon_staging.csv", dtype={"product_id": str})

    grouped = (
        amazon.groupby("product_id", as_index=False)
        .agg(source_country=("country", lambda series: series.dropna().iloc[0] if not series.dropna().empty else None))
    )
    merged = grouped.merge(
        source_product_map.loc[source_product_map["source_system"] == AMAZON_SOURCE].rename(
            columns={"source_product_id": "product_id", "product_id": "unified_product_id"}
        ),
        on="product_id",
        how="inner",
    )

    result: dict[str, tuple[str, str | None]] = {}
    for row in merged.itertuples(index=False):
        source_country = str(row.source_country) if pd.notna(row.source_country) else None
        result[str(row.unified_product_id)] = (country_to_currency(source_country), source_country)
    return result


def main() -> None:
    amazon_map = build_amazon_product_currency_map()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE products p
                SET currency = 'GBP'
                FROM stores s
                WHERE p.store_id = s.id
                  AND s.name = %s
                """,
                (ONLINE_RETAIL_STORE_NAME,),
            )
            cursor.execute(
                """
                UPDATE products p
                SET currency = 'PKR'
                FROM stores s
                WHERE p.store_id = s.id
                  AND s.name = %s
                """,
                (PAKISTAN_STORE_NAME,),
            )

            for product_id, (currency, source_country) in amazon_map.items():
                cursor.execute(
                    """
                    UPDATE products
                    SET currency = %s,
                        source_country = %s
                    WHERE id = %s
                    """,
                    (currency, source_country, product_id),
                )

    print(f"Backfilled currency/source_country for {len(amazon_map)} Amazon products.")


if __name__ == "__main__":
    main()
