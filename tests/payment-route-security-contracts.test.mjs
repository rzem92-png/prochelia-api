import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function block(startText, endText) {
  const start = source.indexOf(startText);
  assert.notEqual(start, -1, `start exists: ${startText}`);
  const end = source.indexOf(endText, start + startText.length);
  assert.notEqual(end, -1, `end exists: ${endText}`);
  return source.slice(start, end);
}

test('mission payment creation remains disabled at the public route', () => {
  const createRoute = block("if (url.pathname === '/api/payments/mission/create')", "if (url.pathname === '/api/payments/mission/finalize')");
  assert.match(createRoute, /MISSION_PAYMENT_FLOW_NOT_IMPLEMENTED/);
  assert.match(createRoute, /write_enabled:false/);
  assert.doesNotMatch(createRoute, /createMissionPayment\(request,env\)/);
});

test('financial settlement and refunds require PSP events; manager endpoint can only hold', () => {
  const finalize = block('async function finalizeMissionPayment(request, env)', '\nasync function payoutRequest');
  assert.match(finalize, /requireRole\(auth,\['gerante'\]\)/);
  assert.match(finalize, /outcome!=='held'/);
  assert.match(finalize, /PSP_EVENT_REQUIRED_FOR_FINANCIAL_TRANSITION/);
  assert.match(finalize, /status='held'/);
  assert.doesNotMatch(finalize, /status='paid'|status='refunded'/);
});

test('payout feature is disabled by default before payment schema or wallet mutation', () => {
  const payout = block('async function payoutRequest(request, env)', '\nasync function verifyWebhookSignature');
  const gate = payout.indexOf("if(String(env.PAYOUTS_ENABLED).toLowerCase()!=='true')");
  const schema = payout.indexOf('await ensurePaymentSchema(env)');
  assert.ok(gate >= 0 && schema > gate, 'payouts must fail closed before D1 schema/wallet work');
  assert.match(payout, /PAYOUTS_DISABLED_UNTIL_CONNECT_ACCEPTANCE/);
  assert.match(payout, /\},423\)/);
});

test('Stripe webhook is separate from legacy provider webhook route', () => {
  const providerRoute = block("if (url.pathname === '/api/payments/provider-webhook')", "if (url.pathname === '/api/security/mission/prepare')");
  assert.match(providerRoute, /paymentWebhook\(request,env\)/);
  assert.doesNotMatch(providerRoute, /stripeWebhook\(request,env\)/);
  assert.match(source, /stripeWebhook\(request,env\)/);
  assert.match(source, /STRIPE_WEBHOOK_NOT_CONFIGURED/);
});
