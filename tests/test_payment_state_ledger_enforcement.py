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

    def test_stripe_transfer_and_bank_payout_capabilities_are_separate_and_default_closed(self):
        columns = {
            row[1]: row for row in self.db.execute("PRAGMA table_info(payment_accounts)")
        }
        self.assertIn("transfers_enabled", columns)
        self.assertIn("payouts_enabled", columns)
        self.db.execute(
            """INSERT INTO payment_accounts(id,user_id,provider,provider_account_id)
               VALUES('a1','u1','stripe','acct_test')"""
        )
        transfers, payouts = self.db.execute(
            "SELECT transfers_enabled,payouts_enabled FROM payment_accounts WHERE id='a1'"
        ).fetchone()
        self.assertEqual(transfers, 0)
        self.assertEqual(payouts, 0)
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        webhook = source[source.index("async function stripeConnectWebhook"):source.index("async function paymentWebhook")]
        self.assertIn("capabilities?.stripe_transfers?.status", webhook)
        self.assertIn("capabilities?.payouts?.status", webhook)
        self.assertIn("transfers_enabled=?", webhook)
        self.assertIn("payouts_enabled=?", webhook)

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

    def test_production_gate_requires_real_psp_and_release_evidence(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        gate = source[source.index("async function productionConfigCheck"):source.index("async function finalProductionAudit")]
        self.assertIn("paymentsConfigured(env)?'OK':'NOT_IMPLEMENTED'", gate)
        self.assertIn("PSP_RUNTIME_ADAPTER", gate)
        self.assertIn("PSP_SANDBOX_E2E", gate)
        self.assertIn("BACKUP_RESTORE_DRILL", gate)
        self.assertIn("IOS_SAFARI_ACCEPTANCE", gate)
        self.assertIn("FR_LEGAL_OPERATIONAL_SIGNOFF", gate)
        self.assertIn("PRODUCTION_DEPLOYMENT_APPROVAL", gate)
        self.assertIn("'NOT_IMPLEMENTED','NOT_VERIFIED'", gate)
        strict = source[source.index("async function strictProductionAudit"):source.index("const __procheliaProductionSafetyHandle")]
        for code in ("PSP_RUNTIME_ADAPTER", "PSP_SANDBOX_E2E", "BACKUP_RESTORE_DRILL",
                     "IOS_SAFARI_ACCEPTANCE", "FR_LEGAL_OPERATIONAL_SIGNOFF",
                     "PRODUCTION_DEPLOYMENT_APPROVAL"):
            self.assertIn(code, strict)
        configured = source[source.index("function paymentsConfigured"):source.index("async function paymentOnboard")]
        self.assertIn("return false;", configured)

    def test_runtime_account_reads_are_scoped_to_the_active_provider(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        status = source[source.index("async function paymentStatus"):source.index("async function createMissionPayment")]
        payout = source[source.index("async function payoutRequest"):source.index("async function verifyWebhookSignature")]
        self.assertIn("WHERE user_id=? AND provider=?", status)
        self.assertIn("bind(auth.user.id,paymentProvider(env))", status)
        self.assertIn("WHERE user_id=? AND provider=?", payout)
        self.assertIn("bind(auth.user.id,paymentProvider(env))", payout)

    def test_mission_charge_checks_terminal_state_and_preserves_idempotent_replay(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        handler = source[source.index("async function createMissionPayment"):source.index("async function finalizeMissionPayment")]
        terminal = handler.index("MISSION_NOT_PAYABLE")
        recipient_gate = handler.index("RECIPIENT_TRANSFER_CAPABILITY_NOT_READY")
        replay = handler.index("idempotent_replay:true")
        self.assertLess(terminal, replay)
        self.assertLess(replay, recipient_gate)
        self.assertIn("WHERE user_id=? AND provider=?", handler)

    def test_payment_webhook_rejects_unhandled_event_types_before_claiming_them(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        webhook = source[source.index("async function paymentWebhook"):source.index("async function openPaymentDispute")]
        self.assertIn("const supportedEvents=new Set([", webhook)
        self.assertIn("if(!supportedEvents.has(type))", webhook)
        self.assertIn("PSP_EVENT_NOT_SUPPORTED", webhook)
        self.assertLess(webhook.index("PSP_EVENT_NOT_SUPPORTED"), webhook.index("INSERT OR IGNORE INTO payment_webhook_events"))

    def test_only_one_open_dispute_can_exist_per_transaction(self):
        self.create_transaction()
        self.add_open_dispute()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO payment_disputes
                   (id,mission_id,transaction_id,client_id,intervenant_id,status,reason,amount_cents)
                   VALUES('d2','m1','t1','client-u1','u1','open','second dispute',1000)"""
            )

    def test_dispute_can_only_be_canceled_while_its_payment_is_pending(self):
        self.create_transaction()
        self.add_open_dispute()
        self.db.execute(
            "UPDATE payment_disputes SET status='resolved',resolution='cancel' WHERE id='d1'"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE payment_disputes SET status='open' WHERE id='d1'"
            )

    def test_settled_payment_dispute_cannot_be_canceled_without_refund_workflow(self):
        self.create_transaction()
        self.db.execute("UPDATE payment_transactions SET status='paid' WHERE id='t1'")
        self.add_open_dispute()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE payment_disputes SET status='resolved',resolution='cancel' WHERE id='d1'"
            )

    def test_duplicate_open_dispute_is_a_conflict_not_an_internal_error(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        handler = source[source.index("async function openPaymentDispute"):source.index("async function paymentAdminResolve")]
        self.assertIn("PAYMENT_DISPUTE_ALREADY_OPEN", handler)
        self.assertIn("DISPUTE_ALREADY_OPEN", handler)
        self.assertIn("},409)", handler)


    def test_webhook_acknowledgement_is_conditioned_on_persisted_state_and_provider_reference(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        webhook = source[source.index("async function paymentWebhook"):source.index("async function openPaymentDispute")]
        self.assertIn("PAYMENT_WEBHOOK_PROVIDER_REFERENCE_CONFLICT", webhook)
        self.assertIn("PAYOUT_WEBHOOK_PROVIDER_REFERENCE_CONFLICT", webhook)
        self.assertIn("const stateGuard=paymentGuard", webhook)
        self.assertIn("AND ${stateGuard}", webhook)
        self.assertIn("INSERT INTO payment_audit", webhook)
        self.assertIn("SELECT ?,?,?,?,?,? WHERE ${stateGuard}", webhook)
        self.assertIn("const completion=results?.[results.length-2]", webhook)
        self.assertIn("PAYMENT_WEBHOOK_STATE_CONFLICT", webhook)
        self.assertIn("PAYOUT_WEBHOOK_STATE_CONFLICT", webhook)

    def test_held_payment_cannot_be_reversed_by_a_late_failure_webhook(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        webhook = source[source.index("async function paymentWebhook"):source.index("async function openPaymentDispute")]
        self.assertIn("tx.status==='held'&&newPaymentStatus==='failed'&&!tx.provider_payment_id", webhook)
        self.assertIn("else if(tx.status==='held'&&newPaymentStatus==='failed')", webhook)


    def test_runtime_fails_closed_without_dispute_guard_migration(self):
        source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
        ensure = source[source.index("async function ensurePaymentSchema"):source.index("function moneyCents")]
        readiness = source[source.index("if (url.pathname === '/api/readiness')"):source.index("if (url.pathname === '/api/info')")]
        for trigger in ("trg_payment_dispute_single_open", "trg_payment_dispute_state_guard"):
            self.assertIn(trigger, ensure)
            self.assertIn(trigger, readiness)
        self.assertIn("Number(guards?.total || 0) !== 18", ensure)
        self.assertIn("Number(guards?.total||0)===18", readiness)
        self.assertIn("PAYMENT_LEDGER_OR_DISPUTE_GUARDS_MIGRATION_REQUIRED", readiness)


if __name__ == "__main__":
    unittest.main()
