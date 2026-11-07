#!/usr/bin/env python3
"""Apply every PROCHÉLIA SQL migration in order to a disposable SQLite database.

This is a local CI smoke test only. It never connects to Cloudflare D1.
"""
from pathlib import Path
import re
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"

def main() -> int:
    files = sorted(MIGRATIONS.glob("*.sql"))
    if not files:
        raise AssertionError("No SQL migrations found")

    versions = []
    for path in files:
        match = re.match(r"^(\d{4})_", path.name)
        if not match:
            raise AssertionError(f"Migration filename lacks numeric prefix: {path.name}")
        versions.append(int(match.group(1)))

    expected = list(range(1, len(files) + 1))
    if versions != expected:
        raise AssertionError(f"Migration sequence is not contiguous: {versions}; expected {expected}")

    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    try:
        for path in files:
            sql = path.read_text(encoding="utf-8")
            try:
                db.executescript(sql)
            except sqlite3.Error as exc:
                raise AssertionError(f"Migration {path.name} failed: {exc}") from exc

        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise AssertionError(f"SQLite integrity_check failed: {integrity}")

        foreign_key_errors = db.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_key_errors:
            raise AssertionError(f"Foreign-key violations: {foreign_key_errors[:10]}")

        tables = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        indexes = db.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        if not tables:
            raise AssertionError("No tables were created by the migration chain")

        print(f"PASS: {len(files)} migrations applied in order")
        print(f"PASS: {len(tables)} tables, {len(indexes)} indexes")
        print("PASS: SQLite integrity_check = ok; foreign_key_check = clean")
        return 0
    finally:
        db.close()

if __name__ == "__main__":
    sys.exit(main())
