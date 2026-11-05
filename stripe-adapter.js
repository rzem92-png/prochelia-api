// PROCHÉLIA Stripe adapter — Cloudflare Workers Web Crypto only.
// Verifies the native Stripe-Signature header against the exact raw request body.
export async function verifyStripeSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (typeof rawBody !== 'string' || !header || !secret) return false;
  const parts = String(header).split(',').map(x => x.trim());
  const timestamps = parts.filter(x => x.startsWith('t=')).map(x => x.slice(2));
  const signatures = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0]) || signatures.length < 1) return false;
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamps[0]}.${rawBody}`)));
  const expected = [...digest].map(x => x.toString(16).padStart(2, '0')).join('');
  // Constant-time comparison for every candidate v1 signature.
  const equal = (a,b) => { if (a.length !== b.length) return false; let d=0; for(let i=0;i<a.length;i++) d |= a.charCodeAt(i)^b.charCodeAt(i); return d===0; };
  return signatures.some(s => /^[a-f0-9]{64}$/i.test(s) && equal(s.toLowerCase(), expected));
}

export function stripeCheckoutPayload({ transactionId, amountCents, currency='eur', successUrl, cancelUrl, productName='Prestation PROCHÉLIA', clientReferenceId }) {
  if (!transactionId || !Number.isSafeInteger(amountCents) || amountCents < 50 || !/^https:\/\//i.test(successUrl || '') || !/^https:\/\//i.test(cancelUrl || '')) throw new Error('INVALID_CHECKOUT_INPUT');
  const p = new URLSearchParams();
  p.set('mode','payment');
  p.set('success_url',successUrl);
  p.set('cancel_url',cancelUrl);
  p.set('client_reference_id',clientReferenceId || transactionId);
  p.set('metadata[prochelia_transaction_id]',transactionId);
  p.set('payment_intent_data[metadata][prochelia_transaction_id]',transactionId);
  p.set('line_items[0][quantity]','1');
  p.set('line_items[0][price_data][currency]',String(currency).toLowerCase());
  p.set('line_items[0][price_data][unit_amount]',String(amountCents));
  p.set('line_items[0][price_data][product_data][name]',productName.slice(0,120));
  return p;
}


// Resolve PROCHÉLIA transaction metadata from a Stripe PaymentIntent when a
// Charge/Dispute webhook does not include it directly. Do not guess identifiers.
export async function resolveStripeTransactionId(paymentIntentId, secret, fetchImpl = fetch) {
  if (typeof paymentIntentId !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId) || !secret) return null;
  let response;
  try {
    response = await fetchImpl('https://api.stripe.com/v1/payment_intents/' + encodeURIComponent(paymentIntentId), {
      method: 'GET', headers: { authorization: 'Bearer ' + secret }
    });
  } catch { return null; }
  if (!response?.ok) return null;
  let intent;
  try { intent = await response.json(); } catch { return null; }
  if (intent?.id !== paymentIntentId) return null;
  const txId = intent?.metadata?.prochelia_transaction_id;
  return typeof txId === 'string' && txId.trim() ? txId.trim() : null;
}

// Stripe webhook amounts are expressed in the smallest currency unit. A dispute
// represents the disputed portion (which may be partial); payment/refund Charge
// objects must still match the original transaction gross amount.
export function stripeWebhookAmountMatches({ eventType, amount, currency, grossCents, transactionCurrency = 'EUR' }) {
  const cents = Number(amount);
  const gross = Number(grossCents);
  const normalizedCurrency = String(currency || '').toLowerCase();
  const expectedCurrency = String(transactionCurrency || 'EUR').toLowerCase();
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(gross) || gross <= 0 || !normalizedCurrency || normalizedCurrency !== expectedCurrency) return false;
  if (eventType === 'charge.dispute.created' || eventType === 'charge.dispute.closed') return cents > 0 && cents <= gross;
  return cents === gross;
}
