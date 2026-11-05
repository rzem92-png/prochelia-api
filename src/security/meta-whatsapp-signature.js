/**
 * Verify Meta WhatsApp Cloud API webhook signatures.
 * Meta sends X-Hub-Signature-256: sha256=<lowercase hex HMAC-SHA256>.
 * Compute over the exact raw request body with the Meta App Secret.
 * This is signature verification only; webhook challenge and event replay
 * protection must be implemented by the receiving route separately.
 */
const encoder = new TextEncoder();

function constantTimeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function verifyMetaWhatsAppSignature({ appSecret, rawBody, signature }) {
  if (typeof appSecret !== "string" || appSecret.length === 0 ||
      typeof rawBody !== "string" || typeof signature !== "string") {
    return { ok: false, reason: "MALFORMED" };
  }
  if (!/^sha256=[0-9a-f]{64}$/.test(signature)) {
    return { ok: false, reason: "INVALID_SIGNATURE_FORMAT" };
  }
  try {
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = new Uint8Array(mac);
    const actual = hexToBytes(signature.slice(7));
    return constantTimeEqual(expected, actual)
      ? { ok: true }
      : { ok: false, reason: "SIGNATURE_MISMATCH" };
  } catch {
    return { ok: false, reason: "VERIFICATION_ERROR" };
  }
}
