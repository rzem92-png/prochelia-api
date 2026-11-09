import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PaymentStateLedgerEnforcementTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for migration in sorted((ROOT / "migrations").glob("*.sql")):
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.db.execute(
            "INSERT INTO wallets(id,user_id,currency,available_cents) VALUES('w1','u1','EUR',10000)"
        )

    def tearDown(self):
        self.db.close()

    def create_transaction(self, tx_id="t1", net=4500):
        self.db.execute(
            """INSERT INTO payment_transactions
               (id,idempotency_key,mission_id,client_id,intervenant_id,type,status,
                gross_cents,commission_cents,net_intervenant_cents,currency,provider)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tx_id, "idem-" + tx_id, "m1", "client-u1", "u1",
             "MISSION_CHARGE", "pending", net + 500, 500, net, "EUR", "psp_adapter"),
        )

    def balances(self):
        return self.db.execute(
            "SELECT available_cents,reserved_cents,paid_cents FROM wallets WHERE id='w1'"
        ).fetchone()

    def test_settlement_credits_wallet_through_ledger_once(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        self.assertEqual(self.balances(), (14500, 0, 0))
        count = self.db.execute(
            "SELECT COUNT(*) FROM payment_wallet_ledger WHERE transaction_id='t1'"
        ).fetchone()[0]
        self.assertEqual(count, 1)

    def test_dispute_hold_moves_available_to_reserved(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        self.db.execute("UPDATE payment_transactions SET status='held' WHERE id='t1'")
        self.assertEqual(self.balances(), (10000, 4500, 0))

    def add_open_dispute(self):
        self.db.execute(
            """INSERT INTO payment_disputes
               (id,mission_id,transaction_id,client_id,intervenant_id,status,reason,amount_cents)
               VALUES('d1','m1','t1','client-u1','u1','open','service dispute',5000)"""
        )

    def test_charge_settled_after_dispute_is_reserved_not_withdrawable(self):
        self.create_transaction()
        self.add_open_dispute()
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        self.assertEqual(self.balances(), (10000, 4500, 0))
        entry = self.db.execute(
            "SELECT entry_type FROM payment_wallet_ledger WHERE transaction_id='t1'"
        ).fetchone()[0]
        self.assertEqual(entry, "MISSION_PAYMENT_DISPUTED")

    def test_dispute_insert_racing_after_settlement_moves_paid_credit_to_hold(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        self.assertEqual(self.balances(), (14500, 0, 0))
        self.add_open_dispute()
        status = self.db.execute("SELECT status FROM payment_transactions WHERE id='t1'").fetchone()[0]
        self.assertEqual(status, "held")
        self.assertEqual(self.balances(), (10000, 4500, 0))

    def test_late_psp_settlement_of_held_charge_is_reserved(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='held' WHERE id='t1'")
        self.db.execute("UPDATE payment_transactions SET provider_payment_id='ch_1' WHERE id='t1'")
        self.assertEqual(self.balances(), (10000, 4500, 0))

    def test_held_pending_charge_can_fail_without_wallet_credit(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='held' WHERE id='t1'")
        self.db.execute("UPDATE payment_transactions SET status='failed',provider_payment_id='ch_failed' WHERE id='t1'")
        self.assertEqual(self.balances(), (10000, 0, 0))

    def test_payout_request_reserves_atomically_and_failure_releases(self):
        self.db.execute(
            """INSERT INTO payout_requests
               (id,idempotency_key,wallet_id,user_id,amount_cents,currency,mode,status)
               VALUES('p1','payout-1','w1','u1',3000,'EUR','standard','requested')"""
        )
        self.assertEqual(self.balances(), (7000, 3000, 0))
        self.db.execute("UPDATE payout_requests SET status='processing' WHERE id='p1'")
        self.db.execute("UPDATE payout_requests SET status='failed' WHERE id='p1'")
        self.assertEqual(self.balances(), (10000, 0, 0))

    def test_payout_completion_settles_reserved_balance_once(self):
        self.db.execute(
            """INSERT INTO payout_requests
               (id,idempotency_key,wallet_id,user_id,amount_cents,currency,mode,status)
               VALUES('p2','payout-2','w1','u1',3000,'EUR','standard','requested')"""
        )
        self.db.execute("UPDATE payout_requests SET status='processing' WHERE id='p2'")
        self.db.execute("UPDATE payout_requests SET status='completed' WHERE id='p2'")
        self.assertEqual(self.balances(), (7000, 0, 3000))
        count = self.db.execute(
            "SELECT COUNT(*) FROM payment_wallet_ledger WHERE payout_id='p2'"
        ).fetchone()[0]
        self.assertEqual(count, 2)

    def test_concurrent_overspend_is_rejected_by_database_guard(self):
        self.db.execute(
            """INSERT INTO payout_requests
               (id,idempotency_key,wallet_id,user_id,amount_cents,currency,mode,status)
               VALUES('p3','payout-3','w1','u1',7000,'EUR','standard','requested')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO payout_requests
                   (id,idempotency_key,wallet_id,user_id,amount_cents,currency,mode,status)
                   VALUES('p4','payout-4','w1','u1',4000,'EUR','standard','requested')"""
            )
        self.assertEqual(self.balances(), (3000, 7000, 0))

    def test_unsupported_refund_and_terminal_reversal_are_blocked(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE payment_transactions SET status='refunded' WHERE id='t1'")
        self.db.execute(
            """INSERT INTO payout_requests
               (id,idempotency_key,wallet_id,user_id,amount_cents,currency,mode,status)
               VALUES('p5','payout-5','w1','u1',1000,'EUR','standard','requested')"""
        )
        self.db.execute("UPDATE payout_requests SET status='completed' WHERE id='p5'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE payout_requests SET status='failed' WHERE id='p5'")

    def test_runtime_payment_handlers_do_not_mutate_wallet_balances_directly(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        self.assertNotRegex(source, r"UPDATE\s+wallets\s+SET")
        self.assertIn("PAYMENT_SCHEMA_OR_LEDGER_MIGRATION_REQUIRED", source)
        self.assertIn("trg_payment_tx_settle_held_ledger", source)
        self.assertIn("trg_payment_tx_credit_disputed_ledger", source)
        self.assertIn("trg_payment_dispute_hold_paid_tx", source)
        ensure = source[source.index("async function ensurePaymentSchema"):source.index("function moneyCents")]
        self.assertNotIn("CREATE TABLE", ensure)
        status = source[source.index("async function paymentStatus"):source.index("async function createMissionPayment")]
        self.assertNotIn("INSERT INTO wallets", status)
        self.assertIn("PSP_ADAPTER_NOT_IMPLEMENTED", source)
        self.assertIn("return false;", source[source.index("function paymentsConfigured"):source.index("async function paymentOnboard")])

    def test_ledger_is_append_only(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE payment_wallet_ledger SET available_delta_cents=0 WHERE transaction_id='t1'"
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM payment_wallet_ledger WHERE transaction_id='t1'")


if __name__ == "__main__":
    unittest.main()
