from __future__ import annotations

from contextlib import contextmanager
import os

import psycopg


DB_CONFIG = {
    "host": os.getenv("ETL_DB_HOST", "localhost"),
    "port": int(os.getenv("ETL_DB_PORT", "5432")),
    "dbname": os.getenv("ETL_DB_NAME", "e-commerce"),
    "user": os.getenv("ETL_DB_USER", "postgres"),
    "password": os.getenv("ETL_DB_PASSWORD", "postgres"),
}


@contextmanager
def get_connection():
    connection = psycopg.connect(**DB_CONFIG)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
