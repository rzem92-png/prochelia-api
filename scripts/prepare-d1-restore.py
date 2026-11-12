#!/usr/bin/env python3
"""Prepare a D1-compatible restore SQL file from a locally validated SQLite database.

Creates all tables first, inserts rows in foreign-key parent-before-child order,
then recreates indexes, triggers and views. Refuses missing parents, cycles,
virtual tables and source foreign-key violations rather than creating a partial
or misleading restore.
"""
from __future__ import annotations

import argparse
import math
import sqlite3
import sys
from pathlib import Path


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if math.isnan(value):
            return "NULL"
        if math.isinf(value):
            return "9e999" if value > 0 else "-9e999"
        return repr(value)
    if isinstance(value, bytes):
        return "X'" + value.hex() + "'"
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    raise TypeError(f"Unsupported SQLite value type: {type(value).__name__}")


def foreign_key_order(db: sqlite3.Connection, tables: list[str]) -> list[str]:
    table_set = set(tables)
    dependencies: dict[str, set[str]] = {table: set() for table in tables}
    children: dict[str, set[str]] = {table: set() for table in tables}

    for child in tables:
        for row in db.execute(f"PRAGMA foreign_key_list({quote_identifier(child)})"):
            parent = str(row[2])
            if parent not in table_set:
                raise ValueError(f"Foreign-key parent table missing from backup: {parent}")
            if parent == child:
                raise ValueError(f"Self-referencing foreign key requires manual restore review: {child}")
            dependencies[child].add(parent)
            children[parent].add(child)

    ready = sorted(table for table, deps in dependencies.items() if not deps)
    ordered: list[str] = []
    while ready:
        parent = ready.pop(0)
        ordered.append(parent)
        for child in sorted(children[parent]):
            dependencies[child].discard(parent)
            if not dependencies[child] and child not in ordered and child not in ready:
                ready.append(child)
        ready.sort()

    if len(ordered) != len(tables):
        cyclic = sorted(table for table in tables if table not in ordered)
        raise ValueError("Circular foreign-key dependency; refusing remote restore: " + ", ".join(cyclic))
    return ordered


def prepare(source: Path, destination: Path) -> dict[str, int]:
    uri = source.resolve().as_uri() + "?mode=ro"
    db = sqlite3.connect(uri, uri=True)
    db.row_factory = sqlite3.Row
    try:
        db.execute("PRAGMA query_only=ON")
        fk_violations = db.execute("PRAGMA foreign_key_check").fetchall()
        if fk_violations:
            raise ValueError(f"Source SQLite contains {len(fk_violations)} foreign-key violation(s)")

        objects = db.execute(
            """SELECT type, name, sql
               FROM sqlite_master
               WHERE name NOT LIKE 'sqlite_%'
                 AND name <> '_cf_KV'
                 AND type IN ('table', 'index', 'view', 'trigger')
               ORDER BY type, name"""
        ).fetchall()
        table_rows = [row for row in objects if row["type"] == "table"]
        tables = [str(row["name"]) for row in table_rows]
        if not tables:
            raise ValueError("Source SQLite contains no application tables")

        for row in table_rows:
            sql = (row["sql"] or "").lstrip().upper()
            if sql.startswith("CREATE VIRTUAL TABLE"):
                raise ValueError(f"Virtual table requires a dedicated restore adapter: {row['name']}")
            # D1 SQLite accepts AUTOINCREMENT, but its sqlite_sequence rows must
            # be restored explicitly; rejecting it is safer than silently resetting IDs.
            if "AUTOINCREMENT" in sql:
                raise ValueError(f"AUTOINCREMENT sequence requires a dedicated restore adapter: {row['name']}")

        # Cloudflare D1 maintains internal metadata tables. They must not be copied
        # as application data; enumerate all application tables above and fail closed
        # on unsupported virtual tables or foreign-key structures.

        order = foreign_key_order(db, tables)
        schema_sql = {
            str(row["name"]): str(row["sql"])
            for row in table_rows
            if row["sql"]
        }
        if len(schema_sql) != len(tables):
            raise ValueError("One or more application tables have no reproducible CREATE TABLE statement")

        destination.parent.mkdir(parents=True, exist_ok=True)
        row_count = 0
        with destination.open("w", encoding="utf-8", newline="\n") as output:
            output.write("-- PROCHÉLIA D1 restore generated from a locally validated SQLite backup.\n")
            output.write("-- Tables are created first; data is inserted in foreign-key dependency order.\n")
            output.write("-- Transaction wrappers and transient PRAGMAs are intentionally omitted.\n\n")

            output.write("-- Schema: tables\n")
            for table in sorted(tables):
                output.write(schema_sql[table].rstrip(";") + ";\n")

            output.write("\n-- Data: parent tables before dependent tables\n")
            for table in order:
                columns = [str(row["name"]) for row in db.execute(
                    f"PRAGMA table_info({quote_identifier(table)})"
                )]
                if not columns:
                    raise ValueError(f"Could not inspect columns for table: {table}")
                column_sql = ", ".join(quote_identifier(column) for column in columns)
                selected_columns = ", ".join(quote_identifier(column) for column in columns)
                select_sql = f"SELECT {selected_columns} FROM {quote_identifier(table)}"
                cursor = db.execute(select_sql)
                for row in cursor:
                    values = ", ".join(sql_literal(row[column]) for column in columns)
                    output.write(
                        f"INSERT INTO {quote_identifier(table)} ({column_sql}) VALUES ({values});\n"
                    )
                    row_count += 1

            output.write("\n-- Schema: indexes, triggers and views (after data import)\n")
            for row in objects:
                if row["type"] in ("index", "trigger", "view") and row["sql"]:
                    output.write(str(row["sql"]).rstrip(";") + ";\n")

        return {"tables": len(tables), "rows": row_count, "ordered_tables": len(order)}
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        stats = prepare(args.source, args.output)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(
        "Prepared D1 restore SQL: "
        f"{stats['tables']} tables, {stats['rows']} rows, "
        f"{stats['ordered_tables']} dependency-ordered tables."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
