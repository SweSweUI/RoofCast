"""SQLite helpers shared across the pipeline."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable, Sequence

from config import DB_PATH, SCHEMA_PATH


def connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def apply_schema(conn: sqlite3.Connection) -> None:
    sql = Path(SCHEMA_PATH).read_text()
    conn.executescript(sql)
    conn.commit()


def insert_many(conn: sqlite3.Connection, table: str, columns: Sequence[str],
                rows: Iterable[Sequence]) -> int:
    rows = list(rows)
    if not rows:
        return 0
    placeholders = ",".join("?" for _ in columns)
    col_sql = ",".join(columns)
    conn.executemany(
        f"INSERT INTO {table} ({col_sql}) VALUES ({placeholders})", rows
    )
    return len(rows)
