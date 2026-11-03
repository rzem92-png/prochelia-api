"""Source-level regression guards for Stripe webhook safety.

These tests complement (but do not replace) runtime tests against Cloudflare D1
and Stripe test mode. They guard critical fail-closed branches against removal.
"""
from pathlib import Path
import unittest

SOURCE = (Path(__file__).resolve().parents[1] / "src" / "index.js").read_text()


class StripeWebhookSafetySourceTests(unittest.TestCase):
    def test_unmatched_financial_webhook_result_initialized_before_branch(self):
        block = SOURCE[SOURCE.index("const financialEvent="):SOURCE.index("if(txId && (paidEvent.has(event.type)")]
        self.assertLess(block.index("let result='IGNORED'"), block.index("if(financialEvent&&!txId)"))
        self.assertIn("result='FINANCIAL_EVENT_UNMATCHED_RECONCILIATION_REQUIRED'", block)

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

    def test_invalid_refund_amount_is_held_and_audited(self):
        self.assertIn("STRIPE_REFUND_AMOUNT_INVALID", SOURCE)
        self.assertIn("REFUND_AMOUNT_INVALID_HELD", SOURCE)
        self.assertIn("refundedCents>Number(tx.gross_cents||0)", SOURCE)
        self.assertIn("refund_amount_out_of_bounds", SOURCE)

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

    def test_payout_batch_race_replay_checks_payload_and_owner(self):
        self.assertIn("Number(replay.amount_cents)!==amount", SOURCE)
        self.assertIn("String(replay.mode||'standard')!==mode", SOURCE)
        self.assertIn("String(replay.currency||'EUR').toUpperCase()!=='EUR'", SOURCE)

    def test_payout_creation_is_disabled_unless_explicitly_enabled(self):
        self.assertIn("String(env.PAYOUTS_ENABLED).toLowerCase()!=='true'", SOURCE)
        self.assertIn("PAYOUTS_DISABLED_UNTIL_CONNECT_ACCEPTANCE", SOURCE)
        self.assertIn("Number(account.payouts_enabled)!==1", SOURCE)

    def test_payout_reservation_is_balance_conditional_and_batch_atomic(self):
        self.assertIn("available_cents>=?", SOURCE)
        self.assertIn("env.DB.batch([", SOURCE)
        self.assertIn("WHERE changes()=1", SOURCE)
        self.assertIn("reserved_cents=reserved_cents+?", SOURCE)

    def test_payout_terminal_webhook_only_settles_once(self):
        self.assertIn("status NOT IN ('completed','failed','canceled')", SOURCE)
        self.assertIn("WHERE id=? AND changes()=1", SOURCE)
        self.assertIn("reserved_cents=MAX(0,reserved_cents-?)", SOURCE)

    def test_payouts_fail_closed_on_unmatched_stripe_dispute(self):
        self.assertIn("external_id LIKE 'dp_%'", SOURCE)
        self.assertIn("status='unmatched'", SOURCE)

    def test_payouts_block_while_refund_wallet_reconciliation_is_pending(self):
        self.assertIn("PAYOUT_BLOCKED_BY_PENDING_REFUND_RECONCILIATION", SOURCE)
        self.assertIn("status IN ('refund_pending_reconciliation','held')", SOURCE)
        self.assertIn("bind(auth.user.id).first()", SOURCE)

    def test_payouts_block_held_transactions_pending_financial_review(self):
        self.assertIn("PAYOUT_BLOCKED_BY_HELD_TRANSACTION", SOURCE)
        self.assertIn("status IN ('refund_pending_reconciliation','held')", SOURCE)

    def test_payout_reservation_rechecks_financial_locks_atomically(self):
        payout = SOURCE[SOURCE.index("async function payoutRequest"):SOURCE.index("async function ", SOURCE.index("async function payoutRequest")+20)]
        self.assertIn("AND NOT EXISTS (SELECT 1 FROM payment_transactions pt", payout)
        self.assertIn("AND NOT EXISTS (SELECT 1 FROM payment_disputes pd", payout)
        self.assertIn("AND NOT EXISTS (SELECT 1 FROM payment_reconciliation pr", payout)

    def test_invalid_stripe_transaction_mapping_is_quarantined(self):
        self.assertIn("STRIPE_EVENT_TRANSACTION_INVALID", SOURCE)
        self.assertIn("FINANCIAL_EVENT_TRANSACTION_INVALID_RECONCILIATION_REQUIRED", SOURCE)
        self.assertIn("reason:!tx?'transaction_not_found':'provider_mismatch'", SOURCE)
        self.assertIn("internal_transaction_id,amount_cents,currency,status", SOURCE)

    def test_stripe_dispute_amount_is_validated_and_invalid_case_held(self):
        self.assertIn("validDisputeAmount=Number.isSafeInteger(disputedCents)", SOURCE)
        self.assertIn("disputedCents>0&&disputedCents<=Number(tx.gross_cents||0)", SOURCE)
        self.assertIn("STRIPE_DISPUTE_AMOUNT_INVALID_HELD", SOURCE)
        self.assertIn("DISPUTE_AMOUNT_INVALID_HELD_RECONCILIATION_REQUIRED", SOURCE)
        self.assertIn("status IN ('paid','held','refund_pending_reconciliation')", SOURCE)
        self.assertIn("STRIPE_DISPUTE_ID_MISSING", SOURCE)

    def test_dispute_mismatch_holds_transaction_and_creates_reconciliation(self):
        self.assertIn("STRIPE_DISPUTE_MISMATCH_HELD", SOURCE)
        self.assertIn("DISPUTE_MISMATCH_HELD_RECONCILIATION_REQUIRED", SOURCE)
        self.assertIn("validDisputeAmount=Number.isSafeInteger(disputedAmount)", SOURCE)
        self.assertIn("UPDATE payment_transactions SET status='held'", SOURCE)

    def test_background_job_claim_is_atomic_and_skips_lost_races(self):
        self.assertIn("const claim=await env.DB.prepare(`UPDATE background_jobs SET status='RUNNING'", SOURCE)
        self.assertIn("if(Number(claim?.meta?.changes||0)!==1) continue;", SOURCE)

    def test_background_jobs_recover_expired_worker_leases_and_backoff(self):
        self.assertIn("status='RUNNING' AND locked_at<=datetime('now','-15 minutes')", SOURCE)
        self.assertIn("status=CASE WHEN attempts+1>=max_attempts THEN 'FAILED' ELSE 'PENDING' END", SOURCE)
        self.assertIn("Math.min(3600,30*Math.pow(2,Math.min(attempts-1,7)))", SOURCE)
        self.assertIn("WHERE id=? AND status='RUNNING'", SOURCE)

    def test_failed_stripe_event_only_transitions_pending_states(self):
        self.assertIn("['pending','processing','created'].includes(String(tx.status||'').toLowerCase())", SOURCE)
        self.assertIn("WHERE id=? AND status IN ('pending','processing','created')", SOURCE)
        self.assertNotIn("WHERE id=?`).bind(tx.id).run();", SOURCE)

    def test_generic_payment_webhook_body_is_bounded(self):
        self.assertIn("async function paymentWebhook(request, env)", SOURCE)
        self.assertIn("const raw=await readBoundedText(request,MAX_JSON_BODY_BYTES)", SOURCE)
        self.assertIn("WEBHOOK_BODY_TOO_LARGE_OR_INVALID", SOURCE)

    def test_session_cookie_has_secure_browser_flags(self):
        self.assertIn("; HttpOnly; Secure; SameSite=Lax", SOURCE)
        self.assertIn("function sessionCookie(token", SOURCE)

    def test_session_tokens_are_random_and_only_hash_persisted(self):
        self.assertIn("const token = base64url(randomBytes(32))", SOURCE)
        self.assertIn("const tokenHash = await sha256Base64url(token)", SOURCE)
        self.assertIn("token_hash", SOURCE)
        self.assertIn("WHERE s.token_hash = ?", SOURCE)
        self.assertNotIn("INSERT INTO sessions (id, user_id, token, expires_at)", SOURCE)

    def test_session_auth_checks_expiration_and_active_account_each_request(self):
        self.assertIn("s.expires_at > CURRENT_TIMESTAMP", SOURCE)
        self.assertIn("if (row.status !== 'active') return null", SOURCE)
        self.assertIn("JOIN users u ON u.id = s.user_id", SOURCE)

    def test_password_hashing_is_pbkdf2_and_iteration_bounded(self):
        self.assertIn("PBKDF2_ITERATIONS = 100000", SOURCE)
        self.assertIn("iterations < 100000 || iterations > 1000000", SOURCE)
        self.assertIn("hash: 'SHA-256'", SOURCE)

if __name__ == "__main__":
    unittest.main()
