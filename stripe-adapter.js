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
