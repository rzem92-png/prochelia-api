import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature, stripeCheckoutPayload, resolveStripeTransactionId, stripeWebhookAmountMatches } from '../stripe-adapter.js';

const secret='whsec_test_prochelia';
function signature(body,timestamp) {
  const digest=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

test('Stripe webhook signature accepts valid raw-body HMAC within tolerance', async()=>{
  const now=1_800_000_000, body='{"id":"evt_test","type":"payment_intent.succeeded"}';
  assert.equal(await verifyStripeSignature(body,signature(body,now),secret,now),true);
});

test('Stripe webhook signature rejects altered raw body',async()=>{
  const now=1_800_000_000, body='{"id":"evt_test"}';
  assert.equal(await verifyStripeSignature(body+' ',signature(body,now),secret,now),false);
});

test('Stripe webhook signature rejects stale timestamp and malformed headers',async()=>{
  const now=1_800_000_000, body='{}';
  assert.equal(await verifyStripeSignature(body,signature(body,now-301),secret,now),false);
  assert.equal(await verifyStripeSignature(body,'v1=not-a-signature',secret,now),false);
  assert.equal(await verifyStripeSignature(body,signature(body,now),'',now),false);
});

test('Stripe checkout payload pins transaction metadata and amount in cents',()=>{
  const payload=stripeCheckoutPayload({transactionId:'tx-123',amountCents:2500,currency:'EUR',successUrl:'https://app.example/success',cancelUrl:'https://app.example/cancel',clientReferenceId:'client-1'});
  assert.equal(payload.get('metadata[prochelia_transaction_id]'),'tx-123');
  assert.equal(payload.get('payment_intent_data[metadata][prochelia_transaction_id]'),'tx-123');
  assert.equal(payload.get('line_items[0][price_data][unit_amount]'),'2500');
  assert.equal(payload.get('client_reference_id'),'client-1');
});

test('Stripe checkout payload rejects unsafe amount and non-HTTPS redirect URLs',()=>{
  assert.throws(()=>stripeCheckoutPayload({transactionId:'tx',amountCents:49,successUrl:'https://a.test',cancelUrl:'https://b.test'}),/INVALID_CHECKOUT_INPUT/);
  assert.throws(()=>stripeCheckoutPayload({transactionId:'tx',amountCents:100,successUrl:'http://a.test',cancelUrl:'https://b.test'}),/INVALID_CHECKOUT_INPUT/);
});


test('Stripe Charge refund resolves transaction metadata from authenticated PaymentIntent lookup',async()=>{
  const fetchMock=async(url,init)=>{
    assert.equal(String(url).endsWith('/payment_intents/pi_test123'),true);
    assert.equal(init.headers.authorization,'Bearer sk_test');
    return {ok:true,json:async()=>({id:'pi_test123',metadata:{prochelia_transaction_id:'tx-123'}})};
  };
  assert.equal(await resolveStripeTransactionId('pi_test123','sk_test',fetchMock),'tx-123');
});

test('Stripe PaymentIntent lookup rejects mismatched id and invalid identifiers',async()=>{
  const fetchMock=async()=>({ok:true,json:async()=>({id:'pi_other',metadata:{prochelia_transaction_id:'tx-123'}})});
  assert.equal(await resolveStripeTransactionId('pi_test123','sk_test',fetchMock),null);
  assert.equal(await resolveStripeTransactionId('bad-id','sk_test',fetchMock),null);
});


test('Stripe webhook amount validation allows bounded partial disputes but rejects mismatches',()=>{
  const base={currency:'eur',grossCents:10000,transactionCurrency:'EUR'};
  assert.equal(stripeWebhookAmountMatches({...base,eventType:'charge.dispute.created',amount:2500}),true);
  assert.equal(stripeWebhookAmountMatches({...base,eventType:'charge.dispute.created',amount:10001}),false);
  assert.equal(stripeWebhookAmountMatches({...base,eventType:'charge.dispute.created',amount:0}),false);
  assert.equal(stripeWebhookAmountMatches({...base,eventType:'charge.refunded',amount:2500}),false);
  assert.equal(stripeWebhookAmountMatches({...base,eventType:'charge.refunded',amount:10000}),true);
  assert.equal(stripeWebhookAmountMatches({...base,eventType:'charge.refunded',amount:10000,currency:'usd'}),false);
});


test('Stripe PaymentIntent lookup fails closed on HTTP error, fetch exception, invalid JSON, or missing metadata',async()=>{
  assert.equal(await resolveStripeTransactionId('pi_test123','sk_test',async()=>({ok:false,json:async()=>({})})),null);
  assert.equal(await resolveStripeTransactionId('pi_test123','sk_test',async()=>{throw new Error('network down')}),null);
  assert.equal(await resolveStripeTransactionId('pi_test123','sk_test',async()=>({ok:true,json:async()=>{throw new Error('bad json')}})),null);
  assert.equal(await resolveStripeTransactionId('pi_test123','sk_test',async()=>({ok:true,json:async()=>({id:'pi_test123',metadata:{}})})),null);
});
