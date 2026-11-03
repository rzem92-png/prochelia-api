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
