"""Source-level regression guards for Stripe webhook safety.

These tests complement (but do not replace) runtime tests against Cloudflare D1
and Stripe test mode. They guard critical fail-closed branches against removal.
"""
from pathlib import Path
import unittest

SOURCE = (Path(__file__).resolve().parents[1] / "src" / "index.js").read_text()


class StripeWebhookSafetySourceTests(unittest.TestCase):
    def test_unmatched_dispute_and_dispute_closed_are_reconciled(self):
        self.assertIn("event.type==='charge.dispute.closed'", SOURCE)
        self.assertIn("STRIPE_DISPUTE_UNMATCHED", SOURCE)
        self.assertIn("reason:'transaction_id_missing'", SOURCE)
        self.assertIn("DISPUTE_UNMATCHED_PAYOUTS_BLOCKED", SOURCE)

    def test_dispute_closure_does_not_automatically_release_funds(self):
        self.assertIn("closed_pending_reconciliation", SOURCE)
        self.assertIn("STRIPE_DISPUTE_CLOSED_REQUIRES_RECONCILIATION", SOURCE)
        self.assertIn("DISPUTE_CLOSED_PENDING_RECONCILIATION", SOURCE)
        self.assertIn("status='held'", SOURCE)

    def test_refund_requires_reconciliation_and_wallet_reversal(self):
        self.assertIn("refund_pending_reconciliation", SOURCE)
        self.assertIn("STRIPE_REFUND_REQUIRES_RECONCILIATION", SOURCE)
        self.assertIn("wallet_ledger_reversal_not_implemented", SOURCE)

    def test_webhook_event_replay_is_payload_bound_and_claimed(self):
        self.assertIn("WEBHOOK_EVENT_PAYLOAD_MISMATCH", SOURCE)
        self.assertIn("processed=2", SOURCE)
        self.assertIn("processed=1,processed_at=CURRENT_TIMESTAMP", SOURCE)

    def test_payouts_fail_closed_on_unmatched_stripe_dispute(self):
        self.assertIn("external_id LIKE 'dp_%'", SOURCE)
        self.assertIn("status='unmatched'", SOURCE)


if __name__ == "__main__":
    unittest.main()
