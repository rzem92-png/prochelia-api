const STRIPE_API_BASE = "https://api.stripe.com/";
const STRIPE_API_VERSION = "2026-10-28.endive";
const STRIPE_ALLOWED_PATHS = new Set(["v2/core/accounts", "v2/core/account_links"]);

export async function stripePost(env, apiPath, params, idempotencyKey, fetchImpl = fetch) {
  const secret = String(env?.STRIPE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY_NOT_CONFIGURED");
  if (!STRIPE_ALLOWED_PATHS.has(apiPath)) throw new Error("STRIPE_PATH_NOT_ALLOWED");
  if (!idempotencyKey) throw new Error("STRIPE_IDEMPOTENCY_KEY_REQUIRED");

  const response = await fetchImpl(STRIPE_API_BASE + apiPath, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_API_VERSION,
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(params || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(data?.error?.code || data?.error?.type || "unknown").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60);
    throw new Error("STRIPE_API_ERROR_" + response.status + "_" + code);
  }
  return data;
}

export async function stripeGet(env, apiPath, fetchImpl = fetch) {
  const secret = String(env?.STRIPE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY_NOT_CONFIGURED");
  if (!/^v2\/core\/accounts\/acct_[A-Za-z0-9]+$/.test(apiPath)) throw new Error("STRIPE_PATH_NOT_ALLOWED");
  const response = await fetchImpl(STRIPE_API_BASE + apiPath, {
    method: "GET",
    headers: { Authorization: "Bearer " + secret, "Stripe-Version": STRIPE_API_VERSION }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(data?.error?.code || data?.error?.type || "unknown").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60);
    throw new Error("STRIPE_API_ERROR_" + response.status + "_" + code);
  }
  return data;
}

export async function verifyStripeSignature(signatureHeader, secret, rawBody, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || !signatureHeader || typeof rawBody !== "string") return false;
  const parts = String(signatureHeader).split(",").map(x => x.trim());
  const timestampPart = parts.find(x => x.startsWith("t="));
  const timestamp = Number(timestampPart?.slice(2));
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;
  const signatures = parts.filter(x => x.startsWith("v1=")).map(x => x.slice(3).toLowerCase()).filter(x => /^[a-f0-9]{64}$/.test(x));
  if (!signatures.length) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp + "." + rawBody)
  ));
  const expected = Array.from(digest, x => x.toString(16).padStart(2, "0")).join("");
  return signatures.some(candidate => {
    if (candidate.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
    return mismatch === 0;
  });
}
