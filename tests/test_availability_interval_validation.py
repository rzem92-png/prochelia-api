import sqlite3
import unittest
from pathlib import Path


class AvailabilityIntervalMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript("""
            CREATE TABLE disponibilites (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                intervenant_id TEXT NOT NULL,
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                status TEXT NOT NULL
            );
        """)
        migration = Path(__file__).resolve().parents[1] / "migrations-preview-canonical" / "0035_validate_availability_intervals.sql"
        self.db.executescript(migration.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def insert(self, row_id, start_at, end_at, status="available"):
        self.db.execute(
            "INSERT INTO disponibilites(id, tenant_id, intervenant_id, start_at, end_at, status) VALUES (?, 'tenant-a', 'provider-a', ?, ?, ?)",
            (row_id, start_at, end_at, status),
        )

    def test_rejects_malformed_start_and_end_timestamps(self):
        for row_id, start_at, end_at in [
            ("bad-start", "not-a-date", "2026-11-21T10:00:00Z"),
            ("bad-end", "2026-11-21T09:00:00Z", "not-a-date"),
            ("empty-start", "", "2026-11-21T10:00:00Z"),
        ]:
            with self.subTest(row_id=row_id), self.assertRaisesRegex(sqlite3.IntegrityError, "AVAILABILITY_INTERVAL_INVALID"):
                self.insert(row_id, start_at, end_at)

    def test_rejects_zero_length_and_reversed_intervals(self):
        cases = [
            ("zero", "2026-11-21T09:00:00Z", "2026-11-21T09:00:00Z"),
            ("reverse", "2026-11-21T10:00:00Z", "2026-11-21T09:00:00Z"),
        ]
        for row_id, start_at, end_at in cases:
            with self.subTest(row_id=row_id), self.assertRaisesRegex(sqlite3.IntegrityError, "AVAILABILITY_INTERVAL_INVALID"):
                self.insert(row_id, start_at, end_at)

    def test_rejects_invalid_interval_on_update(self):
        self.insert("valid", "2026-11-21T09:00:00Z", "2026-11-21T10:00:00Z")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "AVAILABILITY_INTERVAL_INVALID"):
            self.db.execute(
                "UPDATE disponibilites SET end_at = start_at WHERE id = 'valid'"
            )

    def test_allows_valid_interval_with_explicit_timezone_offset(self):
        self.insert("offset", "2026-11-21T09:00:00+02:00", "2026-11-21T10:00:00+02:00")
        row = self.db.execute(
            "SELECT julianday(end_at) > julianday(start_at) FROM disponibilites WHERE id='offset'"
        ).fetchone()
        self.assertEqual(row[0], 1)

    def test_non_available_legacy_rows_are_not_rewritten_or_blocked(self):
        self.insert("legacy", "legacy-invalid", "legacy-invalid", status="cancelled")
        count = self.db.execute("SELECT COUNT(*) FROM disponibilites WHERE id='legacy'").fetchone()[0]
        self.assertEqual(count, 1)


if __name__ == "__main__":
    unittest.main()
