import pathlib
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

    def test_migration_has_no_destructive_sql(self):
        sql = MIGRATION.read_text(encoding="utf-8").upper()
        for forbidden in ("DROP TABLE", "DROP INDEX", "DELETE FROM", "UPDATE "):
            self.assertNotIn(forbidden, sql)

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
