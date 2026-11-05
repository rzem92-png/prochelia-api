/**
 * PROCHÉLIA webhook signature primitive.
 *
 * Signature format: v1=<lowercase hex HMAC-SHA-256>
 * Signed message: <unix timestamp seconds>.<exact raw body>
 *
 * This helper does NOT implement durable replay protection. Receivers must
 * persist event IDs/nonces atomically and reject duplicates.
 */
const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function constantTimeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacHex(secret, message) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('WEBHOOK_SECRET_TOO_SHORT');
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(new Uint8Array(mac));
}

export async function signWebhook(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  if (typeof rawBody !== 'string') throw new TypeError('RAW_BODY_STRING_REQUIRED');
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new TypeError('INVALID_TIMESTAMP');
  const signature = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return { timestamp: String(timestamp), signature: `v1=${signature}` };
}

export async function verifyWebhook({
  secret, rawBody, timestamp, signature,
  now = Math.floor(Date.now() / 1000), toleranceSeconds = 300
}) {
  if (typeof rawBody !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string') {
    return { ok: false, reason: 'MALFORMED' };
  }
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: 'INVALID_TIMESTAMP' };
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ts) ||
      !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0 ||
      Math.abs(now - ts) > toleranceSeconds) {
    return { ok: false, reason: 'STALE_TIMESTAMP' };
  }
  if (!/^v1=[0-9a-f]{64}$/.test(signature)) return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  let expected;
  try {
    expected = fromHex(await hmacHex(secret, `${timestamp}.${rawBody}`));
  } catch {
    return { ok: false, reason: 'CONFIGURATION_ERROR' };
  }
  const actual = fromHex(signature.slice(3));
  return constantTimeEqual(expected, actual) ? { ok: true } : { ok: false, reason: 'SIGNATURE_MISMATCH' };
}
