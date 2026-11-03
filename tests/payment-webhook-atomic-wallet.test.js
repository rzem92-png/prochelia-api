import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const start=source.indexOf('async function paymentWebhook');
const end=source.indexOf('async function openPaymentDispute',start);
const webhook=source.slice(start,end);

test('transaction status transition is conditional and wallet credit follows changes() guard in batch',()=>{
  assert.match(webhook,/UPDATE payment_transactions SET status=.*WHERE id=\? AND status NOT IN \('paid','failed','refunded'\)/);
  assert.match(webhook,/env\.DB\.batch\(statements\)/);
  assert.match(webhook,/UPDATE wallets SET available_cents=available_cents\+\?,updated_at=CURRENT_TIMESTAMP WHERE user_id=\? AND changes\(\)=1/);
});

test('payout status transition is guarded against duplicate terminal webhook processing',()=>{
  assert.match(webhook,/UPDATE payout_requests SET status=.*WHERE id=\? AND status IN \('requested','processing'\)/);
  assert.match(webhook,/reserved_cents=reserved_cents-\?,paid_cents=paid_cents\+\?.*changes\(\)=1/);
  assert.match(webhook,/reserved_cents=reserved_cents-\?,available_cents=available_cents\+\?.*changes\(\)=1/);
});

test('wallet payout movements cannot decrement reserved funds below requested amount',()=>{
  assert.match(webhook,/reserved_cents>=\?/);
});

const finalizerStart=source.indexOf('async function finalizeMissionPayment');
const finalizerEnd=source.indexOf('async function payoutRequest',finalizerStart);
const finalizer=source.slice(finalizerStart,finalizerEnd);

test('admin cannot manually forge paid, failed, or refunded payment outcomes',()=>{
  assert.match(finalizer,/if\(outcome!=='held'\) return json\(\{ok:false,error:'PSP_WEBHOOK_REQUIRED',version:VERSION\},409\)/);
  assert.match(finalizer,/PSP-confirmed financial outcomes/);
});

const disputeStart=source.indexOf('async function paymentAdminResolve');
const disputeEnd=source.indexOf('async function handleBase',disputeStart);
const disputeResolver=source.slice(disputeStart,disputeEnd);

test('admin dispute resolution records decision but cannot forge PSP payment state',()=>{
  assert.match(disputeResolver,/payment_state_unchanged:true/);
  assert.match(disputeResolver,/payment_status:'held'/);
  assert.match(disputeResolver,/PSP_WEBHOOK_OR_RECONCILIATION/);
  assert.doesNotMatch(disputeResolver,/UPDATE payment_transactions SET status=/);
});

import procheliaV7 from '../src/v7.js';

test('V7 never treats caller-provided payment status as PSP confirmation',()=>{
  for (const status of ['PAID','SUCCEEDED','SUCCESS','COMPLETED']) {
    const result=procheliaV7.checkPayment({status});
    assert.equal(result.ok,false);
    assert.equal(result.paymentConfirmed,false);
    assert.equal(result.verificationRequired,'SERVER_PSP_WEBHOOK_OR_RECONCILIATION');
  }
});

test('V7 QR validation fails closed for caller-supplied payloads',()=>{
  const result=procheliaV7.checkQr({id:'mission-123'},{missionId:'mission-123',signature:'fake'});
  assert.equal(result.ok,false);
  assert.equal(result.qrValidated,false);
  assert.equal(result.verificationRequired,'SERVER_SIGNED_EXPIRING_SINGLE_USE_QR');
});

test('webhook fails closed and leaves event retryable when referenced payment or payout is missing',()=>{
  assert.match(webhook,/if\(!tx\) return json\(\{ok:false,error:'PAYMENT_TRANSACTION_NOT_FOUND',version:VERSION\},503\)/);
  assert.match(webhook,/if\(!payout\) return json\(\{ok:false,error:'PAYOUT_NOT_FOUND',version:VERSION\},503\)/);
});

test('webhook rejects event-ID reuse with a different payload or type',()=>{
  assert.match(webhook,/prior\.payload_hash!==payloadHash \|\| prior\.event_type!==type/);
  assert.match(webhook,/WEBHOOK_EVENT_ID_CONFLICT/);
});

test('payment webhook cannot rewrite terminal transaction states',()=>{
  assert.match(webhook,/WHERE id=\? AND status NOT IN \('paid','failed','refunded'\)/);
});

test('webhook payload is bounded and signature is checked before JSON processing',()=>{
  assert.match(webhook,/total>65536/);
  assert.ok(webhook.indexOf('verifyWebhookSignature(request,env,raw)') < webhook.indexOf('JSON.parse(raw)'));
});
