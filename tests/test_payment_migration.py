import pathlib
import re
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0005_payment_runtime_schema.sql"

class PaymentMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_and_is_idempotent(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        tables = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        expected = {
            "payment_accounts", "wallets", "payment_transactions",
            "payout_requests", "payment_webhook_events", "payment_disputes",
            "payment_reconciliation", "payment_audit", "payment_wallet_ledger",
        }
        self.assertTrue(expected.issubset(tables))

    @staticmethod
    def _assert_no_destructive_sql(sql):
        # Strip full-line and trailing SQL comments before checking statements.
        sql = re.sub(r"--[^\n]*", "", sql).upper()
        forbidden = (
            r"\bDROP\s+TABLE\b",
            r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b",
            r"^\s*UPDATE\s+",
        )
        for pattern in forbidden:
            if re.search(pattern, sql, flags=re.MULTILINE):
                raise AssertionError(f"Destructive SQL detected: {pattern}")

    def test_migration_has_no_destructive_sql(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self._assert_no_destructive_sql(sql)

    def test_destructive_sql_guard_detects_real_statements(self):
        statements = (
            "DROP TABLE users;",
            "DROP INDEX idx_users;",
            "DELETE FROM users;",
            "UPDATE users SET active = 0;",
        )
        for statement in statements:
            with self.subTest(statement=statement):
                with self.assertRaises(AssertionError):
                    self._assert_no_destructive_sql(statement)

    def test_destructive_sql_guard_ignores_comment_text(self):
        self._assert_no_destructive_sql(
            "-- DROP TABLE users;\nCREATE TABLE safe_table (id INTEGER);"
        )

    def test_unique_idempotency_constraints(self):
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO payment_transactions(id,idempotency_key,type,status) VALUES('t1','same','CHARGE','PENDING')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO payment_transactions(id,idempotency_key,type,status) VALUES('t2','same','CHARGE','PENDING')")
        self.db.execute("INSERT INTO payment_webhook_events(id,provider,event_id,event_type) VALUES('w1','provider','evt1','payment')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO payment_webhook_events(id,provider,event_id,event_type) VALUES('w2','provider','evt1','payment')")

if __name__ == "__main__":
    unittest.main()
