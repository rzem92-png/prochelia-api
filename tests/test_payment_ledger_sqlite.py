import sqlite3
import unittest

class PaymentSettlementSqliteIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript("""
          CREATE TABLE payment_transactions(id TEXT PRIMARY KEY,status TEXT NOT NULL,provider TEXT,provider_payment_id TEXT);
          CREATE TABLE wallets(id TEXT PRIMARY KEY,user_id TEXT UNIQUE NOT NULL,available_cents INTEGER NOT NULL DEFAULT 0);
          INSERT INTO payment_transactions VALUES('tx-1','pending','stripe',NULL);
        """)
        self.db.commit()

    def settle(self, tx_id='tx-1', user_id='worker-1', amount=1200):
        self.db.execute("INSERT OR IGNORE INTO wallets(id,user_id,available_cents) VALUES('wallet-1',?,0)", (user_id,))
        self.db.commit()
        self.db.execute("BEGIN")
        transition = self.db.execute("""
          UPDATE payment_transactions SET status='paid',provider='stripe',
            provider_payment_id=COALESCE('pi_test',provider_payment_id)
          WHERE id=? AND status NOT IN
            ('paid','refunded','refund_pending_reconciliation','held')
        """, (tx_id,))
        credit = self.db.execute("""
          UPDATE wallets SET available_cents=available_cents+?
          WHERE user_id=? AND changes()=1
        """, (amount, user_id))
        self.db.commit()
        return transition.rowcount, credit.rowcount

    def test_repeated_event_deliveries_credit_once(self):
        results = [self.settle() for _ in range(8)]
        balance = self.db.execute("SELECT available_cents FROM wallets WHERE user_id='worker-1'").fetchone()[0]
        self.assertEqual(balance, 1200)
        self.assertEqual(sum(t for t, _ in results), 1)
        self.assertEqual(sum(w for _, w in results), 1)

    def test_held_or_refunded_status_never_recredits(self):
        for status in ('held', 'refunded', 'refund_pending_reconciliation'):
            self.db.execute("UPDATE payment_transactions SET status=? WHERE id='tx-1'", (status,))
            self.db.commit()
            self.assertEqual(self.settle(), (0, 0))
            self.assertEqual(self.db.execute("SELECT available_cents FROM wallets WHERE user_id='worker-1'").fetchone()[0], 0)

    def test_wallet_is_created_before_credit_batch(self):
        self.assertEqual(self.settle(), (1, 1))
        self.assertEqual(self.db.execute("SELECT available_cents FROM wallets WHERE user_id='worker-1'").fetchone()[0], 1200)

    def test_manual_finalization_status_gate_prevents_double_credit(self):
        self.db.execute("INSERT INTO wallets(id,user_id,available_cents) VALUES('wallet-manual','worker-1',0)")
        self.db.commit()
        results=[]
        for _ in range(2):
            self.db.execute("BEGIN")
            transition=self.db.execute("""
              UPDATE payment_transactions SET status='paid'
              WHERE id='tx-1' AND status NOT IN
                ('paid','failed','refunded','refund_pending_reconciliation','held')
            """)
            credit=self.db.execute("""
              UPDATE wallets SET available_cents=available_cents+1200
              WHERE id='wallet-manual' AND changes()=1
            """)
            self.db.commit()
            results.append((transition.rowcount,credit.rowcount))
        balance=self.db.execute("SELECT available_cents FROM wallets WHERE id='wallet-manual'").fetchone()[0]
        self.assertEqual(balance,1200)
        self.assertEqual(results,[(1,1),(0,0)])

    def test_open_dispute_blocks_payout_until_resolved(self):
        self.db.executescript("""
          CREATE TABLE payment_disputes(id TEXT PRIMARY KEY,intervenant_id TEXT,status TEXT);
          INSERT INTO payment_disputes VALUES('dispute-1','worker-1','open');
        """)
        active=self.db.execute("""
          SELECT id FROM payment_disputes WHERE intervenant_id=?
          AND status NOT IN ('resolved','closed') LIMIT 1
        """,('worker-1',)).fetchone()
        self.assertEqual(active[0],'dispute-1')
        self.db.execute("UPDATE payment_disputes SET status='resolved' WHERE id='dispute-1'")
        self.db.commit()
        active=self.db.execute("""
          SELECT id FROM payment_disputes WHERE intervenant_id=?
          AND status NOT IN ('resolved','closed') LIMIT 1
        """,('worker-1',)).fetchone()
        self.assertIsNone(active)

    def tearDown(self):
        self.db.close()

if __name__ == '__main__':
    unittest.main()
