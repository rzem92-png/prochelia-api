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


    def test_stripe_webhook_body_is_bounded_before_signature_verification(self):
        self.assertIn("async function readBoundedText(request", SOURCE)
        self.assertIn("MAX_JSON_BODY_BYTES = 1024 * 1024", SOURCE)
        self.assertIn("await readBoundedText(request,MAX_JSON_BODY_BYTES)", SOURCE)
        self.assertIn("STRIPE_WEBHOOK_BODY_TOO_LARGE_OR_INVALID", SOURCE)
        self.assertIn("await reader.cancel('Request body too large')", SOURCE)


    def test_csrf_origin_gate_rejects_missing_origin_for_session_cookie(self):
        self.assertIn("function securityOriginAllowed(request,env)", SOURCE)
        self.assertIn("hasSessionCookie", SOURCE)
        self.assertIn("return !hasSessionCookie", SOURCE)
        self.assertIn("if(isMutatingMethod(request.method) && !securityOriginAllowed(request,env))", SOURCE)
        self.assertIn("allowed.includes(origin)", SOURCE)

    def test_rate_limiter_uses_cloudflare_edge_ip_not_forwarded_header(self):
        self.assertIn("request.headers.get('CF-Connecting-IP')", SOURCE)
        self.assertIn("Never trust", SOURCE)
        self.assertNotIn("request.headers.get('X-Forwarded-For')", SOURCE)
        self.assertIn("DATABASE_REQUIRED_FOR_RATE_LIMIT", SOURCE)
        self.assertIn("Fail closed if the limiter cannot persist", SOURCE)


    def test_security_headers_are_applied_at_worker_entrypoint(self):
        self.assertIn("async fetch(request,env)", SOURCE)
        self.assertIn("const response=await handle(request,env)", SOURCE)
        self.assertIn("headers.set('x-content-type-options','nosniff')", SOURCE)
        self.assertIn("headers.set('x-frame-options','DENY')", SOURCE)
        self.assertIn("headers.set('referrer-policy','no-referrer')", SOURCE)
        self.assertIn("headers.set('permissions-policy','geolocation=(self),camera=(),microphone=()')", SOURCE)
        self.assertIn("new Response(response.body,{status:response.status,statusText:response.statusText,headers})", SOURCE)


    def test_checkout_idempotency_key_is_server_bound_to_transaction(self):
        self.assertIn("'idempotency-key':`prochelia-checkout-${tx.id}`", SOURCE)

    def test_payouts_fail_closed_on_unmatched_stripe_dispute(self):
        self.assertIn("external_id LIKE 'dp_%'", SOURCE)
        self.assertIn("status='unmatched'", SOURCE)


if __name__ == "__main__":
    unittest.main()
