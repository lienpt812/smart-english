from pathlib import Path
from typing import Iterator

import psycopg
from psycopg.rows import dict_row

from app.core.config import settings


def connection() -> Iterator[psycopg.Connection]:
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        yield conn


def get_connection() -> psycopg.Connection:
    return psycopg.connect(settings.database_url, row_factory=dict_row)


def check_postgres() -> bool:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False


def run_migrations() -> None:
    migrations_dir = Path(__file__).resolve().parent.parent / "db" / "migrations"
    if not migrations_dir.exists():
        return

    with get_connection() as conn:
        with conn.cursor() as cur:
            for path in sorted(migrations_dir.glob("*.sql")):
                cur.execute(path.read_text(encoding="utf-8"))
        conn.commit()
