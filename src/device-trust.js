const DEVICE_CHALLENGE_TTL_SECONDS = 5 * 60;
const DEVICE_CREDENTIAL_TTL_DAYS = 90;
const MAX_PENDING_CHALLENGES = 5;

function response(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("INVALID_BASE64URL");
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function sha256Base64url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64url(new Uint8Array(digest));
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function readLimitedJson(request, maxBytes = 8192) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

export function buildDeviceEnrollmentMessage({ challengeId, challenge, tenantId, userId }) {
  return JSON.stringify({
    version: 1,
    purpose: "ENROLL",
    challenge_id: challengeId,
    challenge,
    tenant_id: tenantId,
    user_id: userId
  });
}

export function validateDevicePublicJwk(jwk) {
  if (!jwk || typeof jwk !== "object" || Array.isArray(jwk)) return null;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || typeof jwk.d === "string") return null;
  if (typeof jwk.x !== "string" || typeof jwk.y !== "string") return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(jwk.x) || !/^[A-Za-z0-9_-]{43}$/.test(jwk.y)) return null;
  if (jwk.key_ops && (!Array.isArray(jwk.key_ops) || jwk.key_ops.some(value => value !== "verify"))) return null;
  try {
    if (fromBase64url(jwk.x).length !== 32 || fromBase64url(jwk.y).length !== 32) return null;
  } catch {
    return null;
  }
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true, key_ops: ["verify"] };
}

export async function deviceKeyThumbprint(publicJwk) {
  const key = validateDevicePublicJwk(publicJwk);
  if (!key) throw new Error("INVALID_DEVICE_PUBLIC_KEY");
  return sha256Base64url(JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y }));
}

export async function verifyDeviceEnrollmentSignature({ publicJwk, signature, message }) {
  const keyJwk = validateDevicePublicJwk(publicJwk);
  if (!keyJwk || typeof signature !== "string" || signature.length !== 86) return false;
  try {
    const signatureBytes = fromBase64url(signature);
    if (signatureBytes.length !== 64) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      keyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signatureBytes,
      new TextEncoder().encode(message)
    );
  } catch {
    return false;
  }
}

async function handleChallenge(request, env, auth, tenantId, requireVerifiedIntervenant) {
  let verified;
  try {
    verified = await requireVerifiedIntervenant(env, auth.user.id, tenantId);
  } catch {
    return response({ ok: false, error: "IDENTITY_SCHEMA_UNAVAILABLE", write_enabled: false }, 503);
  }
  if (!verified) return response({ ok: false, error: "IDENTITY_VERIFICATION_REQUIRED" }, 403);

  try {
    const pending = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM device_auth_challenges
       WHERE tenant_id = ? AND user_id = ? AND session_id = ? AND purpose = 'ENROLL'
         AND consumed_at IS NULL AND julianday(expires_at) > julianday('now')`
    ).bind(tenantId, auth.user.id, auth.session_id).first();
    if (Number(pending?.total || 0) >= MAX_PENDING_CHALLENGES) {
      return response({ ok: false, error: "TOO_MANY_PENDING_DEVICE_CHALLENGES" }, 429);
    }

    const challengeId = crypto.randomUUID();
    const challenge = randomChallenge();
    const challengeHash = await sha256Base64url(challenge);
    const inserted = await env.DB.prepare(
      `INSERT INTO device_auth_challenges
       (id, tenant_id, user_id, session_id, purpose, challenge_hash, expires_at)
       SELECT ?, ?, ?, ?, 'ENROLL', ?, datetime('now', '+5 minutes')
       WHERE (
         SELECT COUNT(*) FROM device_auth_challenges
         WHERE tenant_id = ? AND user_id = ? AND session_id = ? AND purpose = 'ENROLL'
           AND consumed_at IS NULL AND julianday(expires_at) > julianday('now')
       ) < ?`
    ).bind(
      challengeId, tenantId, auth.user.id, auth.session_id, challengeHash,
      tenantId, auth.user.id, auth.session_id, MAX_PENDING_CHALLENGES
    ).run();
    if (Number(inserted?.meta?.changes || 0) !== 1) {
      return response({ ok: false, error: "TOO_MANY_PENDING_DEVICE_CHALLENGES" }, 429);
    }

    const signingMessage = buildDeviceEnrollmentMessage({
      challengeId, challenge, tenantId, userId: auth.user.id
    });
    return response({
      ok: true,
      purpose: "ENROLL",
      algorithm: "ECDSA_P256_SHA256",
      challenge_id: challengeId,
      challenge,
      signing_message: signingMessage,
      expires_in_seconds: DEVICE_CHALLENGE_TTL_SECONDS
    }, 201);
  } catch {
    return response({ ok: false, error: "DEVICE_TRUST_SCHEMA_UNAVAILABLE", write_enabled: false }, 503);
  }
}

async function handleComplete(request, env, auth, tenantId, requireVerifiedIntervenant) {
  const parsed = await readLimitedJson(request);
  if (!parsed.ok) return response({ ok: false, error: parsed.tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON" }, parsed.tooLarge ? 413 : 400);
  const body = parsed.value;
  const challengeId = typeof body?.challenge_id === "string" ? body.challenge_id : "";
  const challenge = typeof body?.challenge === "string" ? body.challenge : "";
  const signature = typeof body?.signature === "string" ? body.signature : "";
  const publicJwk = validateDevicePublicJwk(body?.public_key_jwk);
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^[A-Za-z0-9_-]{43}$/.test(challenge) || !publicJwk || signature.length !== 86) {
    return response({ ok: false, error: "INVALID_DEVICE_ENROLLMENT_PAYLOAD" }, 400);
  }

  let verifiedIdentity;
  let challengeRow;
  try {
    verifiedIdentity = await requireVerifiedIntervenant(env, auth.user.id, tenantId);
    if (!verifiedIdentity) return response({ ok: false, error: "IDENTITY_VERIFICATION_REQUIRED" }, 403);
    const challengeHash = await sha256Base64url(challenge);
    challengeRow = await env.DB.prepare(
      `SELECT id FROM device_auth_challenges
       WHERE id = ? AND tenant_id = ? AND user_id = ? AND session_id = ?
         AND purpose = 'ENROLL' AND challenge_hash = ? AND consumed_at IS NULL
         AND julianday(expires_at) > julianday('now') LIMIT 1`
    ).bind(challengeId, tenantId, auth.user.id, auth.session_id, challengeHash).first();
    if (!challengeRow) return response({ ok: false, error: "DEVICE_ENROLLMENT_CHALLENGE_INVALID_OR_EXPIRED" }, 409);

    const signingMessage = buildDeviceEnrollmentMessage({
      challengeId, challenge, tenantId, userId: auth.user.id
    });
    const validSignature = await verifyDeviceEnrollmentSignature({
      publicJwk, signature, message: signingMessage
    });
    if (!validSignature) return response({ ok: false, error: "DEVICE_ENROLLMENT_PROOF_INVALID" }, 401);

    const thumbprint = await deviceKeyThumbprint(publicJwk);
    const credentialId = crypto.randomUUID();
    const consumedMarker = `${new Date().toISOString()}:${crypto.randomUUID()}`;
    const credentialExpiry = new Date(Date.now() + DEVICE_CREDENTIAL_TTL_DAYS * 86400000).toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE device_auth_challenges SET consumed_at = ?
         WHERE id = ? AND tenant_id = ? AND user_id = ? AND session_id = ?
           AND purpose = 'ENROLL' AND challenge_hash = ? AND consumed_at IS NULL
           AND julianday(expires_at) > julianday('now')`
      ).bind(consumedMarker, challengeId, tenantId, auth.user.id, auth.session_id, challengeHash),
      env.DB.prepare(
        `INSERT INTO trusted_device_credentials
         (id, tenant_id, user_id, public_key_jwk, key_thumbprint, algorithm, status, expires_at)
         SELECT ?, tenant_id, user_id, ?, ?, 'ECDSA_P256_SHA256', 'active', ?
         FROM device_auth_challenges
         WHERE id = ? AND tenant_id = ? AND user_id = ? AND session_id = ?
           AND purpose = 'ENROLL' AND challenge_hash = ? AND consumed_at = ?
           AND julianday(expires_at) > julianday('now')
           AND NOT EXISTS (
             SELECT 1 FROM trusted_device_credentials existing
             WHERE existing.tenant_id = device_auth_challenges.tenant_id
               AND existing.user_id = device_auth_challenges.user_id
               AND existing.key_thumbprint = ?
           )`
      ).bind(credentialId, JSON.stringify(publicJwk), thumbprint, credentialExpiry,
        challengeId, tenantId, auth.user.id, auth.session_id, challengeHash, consumedMarker, thumbprint)
    ]);
    const consumed = Number(results?.[0]?.meta?.changes || 0);
    const inserted = Number(results?.[1]?.meta?.changes || 0);
    if (consumed !== 1 || inserted !== 1) {
      return response({ ok: false, error: "DEVICE_ENROLLMENT_CONFLICT" }, 409);
    }
    return response({
      ok: true,
      device: {
        id: credentialId,
        algorithm: "ECDSA_P256_SHA256",
        key_thumbprint: thumbprint,
        status: "active",
        expires_at: credentialExpiry
      },
      proof_of_possession: "verified",
      mission_presence: "still_blocked_until_per_mission_proof_is_implemented"
    }, 201);
  } catch {
    return response({ ok: false, error: "DEVICE_TRUST_SCHEMA_UNAVAILABLE", write_enabled: false }, 503);
  }
}

async function handleList(request, env, auth, tenantId) {
  try {
    const result = await env.DB.prepare(
      `SELECT id, algorithm, key_thumbprint, status, created_at, last_used_at, expires_at, revoked_at
       FROM trusted_device_credentials
       WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(tenantId, auth.user.id).all();
    return response({ ok: true, devices: result.results || [] });
  } catch {
    return response({ ok: false, error: "DEVICE_TRUST_SCHEMA_UNAVAILABLE", write_enabled: false }, 503);
  }
}

async function handleRevoke(request, env, auth, tenantId) {
  const parsed = await readLimitedJson(request, 2048);
  if (!parsed.ok) return response({ ok: false, error: parsed.tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON" }, parsed.tooLarge ? 413 : 400);
  const id = typeof parsed.value?.device_id === "string" ? parsed.value.device_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response({ ok: false, error: "INVALID_DEVICE_ID" }, 400);
  try {
    const result = await env.DB.prepare(
      `UPDATE trusted_device_credentials
       SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'USER_REQUEST'
       WHERE id = ? AND tenant_id = ? AND user_id = ? AND status = 'active'`
    ).bind(id, tenantId, auth.user.id).run();
    if (Number(result?.meta?.changes || 0) !== 1) return response({ ok: false, error: "DEVICE_NOT_FOUND_OR_ALREADY_REVOKED" }, 404);
    return response({ ok: true, device_id: id, status: "revoked" });
  } catch {
    return response({ ok: false, error: "DEVICE_TRUST_SCHEMA_UNAVAILABLE", write_enabled: false }, 503);
  }
}

export async function handleDeviceTrustRoute(request, env, auth, tenantContext, requireVerifiedIntervenant) {
  const path = new URL(request.url).pathname;
  const routes = new Set([
    "/api/security/device/enroll/challenge",
    "/api/security/device/enroll/complete",
    "/api/security/device/list",
    "/api/security/device/revoke"
  ]);
  if (!routes.has(path)) return null;
  if (!auth?.user) return response({ ok: false, error: "UNAUTHENTICATED" }, 401);
  if (!env?.DB) return response({ ok: false, error: "DATABASE_REQUIRED", write_enabled: false }, 503);
  if (auth.user.role !== "intervenant") return response({ ok: false, error: "FORBIDDEN" }, 403);
  if (!tenantContext?.ok || !tenantContext.tenant?.id) {
    return response({ ok: false, error: tenantContext?.error || "TENANT_CONTEXT_REQUIRED" }, tenantContext?.status || 403);
  }
  const tenantId = tenantContext.tenant.id;

  if (path === "/api/security/device/enroll/challenge") {
    if (request.method !== "POST") return response({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
    return handleChallenge(request, env, auth, tenantId, requireVerifiedIntervenant);
  }
  if (path === "/api/security/device/enroll/complete") {
    if (request.method !== "POST") return response({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
    return handleComplete(request, env, auth, tenantId, requireVerifiedIntervenant);
  }
  if (path === "/api/security/device/list") {
    if (request.method !== "GET") return response({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, { allow: "GET" });
    return handleList(request, env, auth, tenantId);
  }
  if (path === "/api/security/device/revoke") {
    if (request.method !== "POST") return response({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
    return handleRevoke(request, env, auth, tenantId);
  }
  return null;
}
