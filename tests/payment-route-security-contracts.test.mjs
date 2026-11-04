import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function routeBlock(path, nextPath) {
  const start = source.indexOf(`if (url.pathname === '${path}')`);
  assert.notEqual(start, -1, `route exists: ${path}`);
  const end = source.indexOf(`if (url.pathname === '${nextPath}')`, start + 1);
  assert.notEqual(end, -1, `next route boundary exists: ${nextPath}`);
  return source.slice(start, end);
}

test('payment mission create and finalize public routes stay disabled until PSP flow is complete', () => {
  const create = routeBlock('/api/payments/mission/create','/api/payments/mission/finalize');
  assert.match(create, /MISSION_PAYMENT_FLOW_NOT_IMPLEMENTED/);
  assert.match(create, /write_enabled:false/);
  assert.doesNotMatch(create, /createMissionPayment\(request,env\)/);

  const finalize = routeBlock('/api/payments/mission/finalize','/api/payments/payout');
  assert.match(finalize, /MISSION_PAYMENT_FINALIZE_NOT_IMPLEMENTED/);
  assert.match(finalize, /write_enabled:false/);
  assert.doesNotMatch(finalize, /finalizeMissionPayment\(request,env\)/);
});

test('payout endpoint retains explicit disabled-by-default feature gate', () => {
  const payout = routeBlock('/api/payments/payout','/api/payments/dispute');
  assert.match(payout, /PAYOUTS_ENABLED/);
  assert.match(payout, /PAYOUTS_DISABLED_UNTIL_CONNECT_ACCEPTANCE/);
  assert.match(payout, /423/);
  assert.doesNotMatch(payout, /PAYOUTS_ENABLED.*true.*payoutRequest/s);
});

test('Stripe webhook and payment provider route are not conflated', () => {
  const providerWebhook = routeBlock('/api/payments/provider-webhook','/api/security/mission/prepare');
  assert.match(providerWebhook, /paymentWebhook\(request,env\)/);
  assert.doesNotMatch(providerWebhook, /stripeWebhook\(request,env\)/);
  assert.match(source, /stripeWebhook\(request,env\)/);
  assert.match(source, /STRIPE_WEBHOOK_NOT_CONFIGURED/);
});
