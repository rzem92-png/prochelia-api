import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  buildDeviceEnrollmentMessage,
  validateDevicePublicJwk,
  deviceKeyThumbprint,
  verifyDeviceEnrollmentSignature,
  handleDeviceTrustRoute
} from "../src/device-trust.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("device enrollment message has a stable, explicit scope", () => {
  assert.equal(
    buildDeviceEnrollmentMessage({
      challengeId: "challenge-1",
      challenge: "random-challenge",
      tenantId: "tenant-1",
      userId: "user-1"
    }),
    JSON.stringify({
      version: 1,
      purpose: "ENROLL",
      challenge_id: "challenge-1",
      challenge: "random-challenge",
      tenant_id: "tenant-1",
      user_id: "user-1"
    })
  );
});

test("only public P-256 JWK material is accepted", async () => {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  assert.ok(validateDevicePublicJwk(jwk));
  assert.equal(validateDevicePublicJwk({ ...jwk, d: "private-material" }), null);
  assert.equal(validateDevicePublicJwk({ ...jwk, crv: "P-384" }), null);
  assert.equal(validateDevicePublicJwk({ ...jwk, x: "short" }), null);
  assert.equal(await deviceKeyThumbprint(jwk), await deviceKeyThumbprint(jwk));
});

test("ECDSA P-256 proof verifies only the exact enrollment message", async () => {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicJwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const message = buildDeviceEnrollmentMessage({
    challengeId: "challenge-2",
    challenge: "opaque-challenge",
    tenantId: "tenant-2",
    userId: "user-2"
  });
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    new TextEncoder().encode(message)
  );
  const encoded = Buffer.from(signature).toString("base64url");
  assert.equal(await verifyDeviceEnrollmentSignature({ publicJwk, signature: encoded, message }), true);
  assert.equal(await verifyDeviceEnrollmentSignature({ publicJwk, signature: encoded, message: message + "x" }), false);
  assert.equal(await verifyDeviceEnrollmentSignature({ publicJwk: { ...publicJwk, d: "private" }, signature: encoded, message }), false);
});

test("malformed and non-64-byte signatures fail closed", async () => {
  assert.equal(await verifyDeviceEnrollmentSignature({
    publicJwk: { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43) },
    signature: "not-a-signature",
    message: "test"
  }), false);
});

test("device routes fail closed before database access when unauthenticated", async () => {
  const request = new Request("https://example.test/api/security/device/list");
  const result = await handleDeviceTrustRoute(request, {}, null, null, async () => false);
  assert.equal(result.status, 401);
  assert.equal((await result.json()).error, "UNAUTHENTICATED");
});

test("device routes are restricted to intervenant accounts", async () => {
  const request = new Request("https://example.test/api/security/device/list");
  const result = await handleDeviceTrustRoute(
    request,
    { DB: {} },
    { user: { id: "user-1", role: "client" } },
    { ok: true, tenant: { id: "tenant-1" } },
    async () => true
  );
  assert.equal(result.status, 403);
  assert.equal((await result.json()).error, "FORBIDDEN");
});

test("device routes require an authoritative tenant context", async () => {
  const request = new Request("https://example.test/api/security/device/list");
  const result = await handleDeviceTrustRoute(
    request,
    { DB: {} },
    { user: { id: "user-1", role: "intervenant" } },
    { ok: false, error: "TENANT_CONTEXT_REQUIRED", status: 403 },
    async () => true
  );
  assert.equal(result.status, 403);
  assert.equal((await result.json()).error, "TENANT_CONTEXT_REQUIRED");
});

test("unknown device paths are not consumed by this router", async () => {
  const request = new Request("https://example.test/api/security/device/unknown");
  const result = await handleDeviceTrustRoute(
    request,
    { DB: {} },
    { user: { id: "user-1", role: "intervenant" } },
    { ok: true, tenant: { id: "tenant-1" } },
    async () => true
  );
  assert.equal(result, null);
});

test("device challenge and enrollment endpoints are POST-only", async () => {
  const request = new Request("https://example.test/api/security/device/enroll/challenge", {
    method: "GET"
  });
  const result = await handleDeviceTrustRoute(
    request,
    { DB: {} },
    { user: { id: "user-1", role: "intervenant" } },
    { ok: true, tenant: { id: "tenant-1" } },
    async () => true
  );
  assert.equal(result.status, 405);
  assert.equal(result.headers.get("allow"), "POST");
});



function createDeviceTrustDb() {
  const state = { challenge: null, credentials: [] };
  const sameChallengeScope = (row, tenantId, userId, sessionId) =>
    row && row.tenantId === tenantId && row.userId === userId && row.sessionId === sessionId && !row.consumedAt && !row.expired;
  const DB = {
    prepare(sql) {
      const statement = {
        sql,
        params: [],
        bind(...params) { this.params = params; return this; },
        async first() {
          if (sql.includes("COUNT(*) AS total FROM device_auth_challenges")) {
            const [tenantId, userId, sessionId] = this.params;
            return { total: sameChallengeScope(state.challenge, tenantId, userId, sessionId) ? 1 : 0 };
          }
          if (sql.includes("SELECT id FROM device_auth_challenges")) {
            const [id, tenantId, userId, sessionId, hash] = this.params;
            const row = state.challenge;
            return row && row.id === id && row.challengeHash === hash &&
              sameChallengeScope(row, tenantId, userId, sessionId) ? { id } : null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT INTO device_auth_challenges")) {
            const [id, tenantId, userId, sessionId, challengeHash] = this.params;
            state.challenge = { id, tenantId, userId, sessionId, challengeHash, consumedAt: null, expired: false };
            return { meta: { changes: 1 } };
          }
          if (sql.includes("UPDATE trusted_device_credentials")) {
            const [id, tenantId, userId] = this.params;
            const row = state.credentials.find(item => item.id === id && item.tenantId === tenantId && item.userId === userId && item.status === "active");
            if (!row) return { meta: { changes: 0 } };
            row.status = "revoked";
            row.revokedAt = new Date().toISOString();
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        async all() {
          const [tenantId, userId] = this.params;
          return {
            results: state.credentials
              .filter(item => item.tenantId === tenantId && item.userId === userId)
              .map(({ id, algorithm, key_thumbprint, status, created_at, last_used_at, expires_at, revoked_at }) =>
                ({ id, algorithm, key_thumbprint, status, created_at, last_used_at, expires_at, revoked_at }))
          };
        }
      };
      return statement;
    },
    async batch(statements) {
      const [update, insert] = statements;
      const [marker, id, tenantId, userId, sessionId, challengeHash] = update.params;
      const row = state.challenge;
      let consumed = 0;
      if (row && row.id === id && row.tenantId === tenantId && row.userId === userId &&
          row.sessionId === sessionId && row.challengeHash === challengeHash && !row.consumedAt && !row.expired) {
        row.consumedAt = marker;
        consumed = 1;
      }
      const [credentialId, publicJwk, thumbprint, credentialExpiry,
        challengeId, insertTenantId, insertUserId, insertSessionId, insertHash, insertMarker] = insert.params;
      let inserted = 0;
      const duplicateKey = state.credentials.some(item =>
        item.tenantId === insertTenantId &&
        item.userId === insertUserId &&
        item.key_thumbprint === thumbprint
      );
      if (consumed === 1 && row.consumedAt === insertMarker && row.id === challengeId &&
          row.tenantId === insertTenantId && row.userId === insertUserId &&
          row.sessionId === insertSessionId && row.challengeHash === insertHash && !duplicateKey) {
        state.credentials.push({
          id: credentialId,
          tenantId: insertTenantId,
          userId: insertUserId,
          public_key_jwk: publicJwk,
          key_thumbprint: thumbprint,
          algorithm: "ECDSA_P256_SHA256",
          status: "active",
          created_at: new Date().toISOString(),
          last_used_at: null,
          expires_at: credentialExpiry,
          revoked_at: null
        });
        inserted = 1;
      }
      return [{ meta: { changes: consumed } }, { meta: { changes: inserted } }];
    }
  };
  return { DB, state };
}

test("device enrollment is session- and tenant-bound, stores only public key material, rejects replay and supports revocation", async () => {
  const { DB, state } = createDeviceTrustDb();
  const auth = { user: { id: "intervenant-1", role: "intervenant" }, session_id: "session-1" };
  const tenantContext = { ok: true, tenant: { id: "tenant-1" } };
  const identityCheck = async (_env, userId, tenantId) =>
    userId === "intervenant-1" && tenantId === "tenant-1" ? { status: "verified" } : null;
  const challengeRequest = new Request("https://example.test/api/security/device/enroll/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  const challengeResponse = await handleDeviceTrustRoute(challengeRequest, { DB }, auth, tenantContext, identityCheck);
  assert.equal(challengeResponse.status, 201);
  const challengeBody = await challengeResponse.json();

  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const publicJwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  assert.equal(pair.privateKey.extractable, false);
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    new TextEncoder().encode(challengeBody.signing_message)
  );
  const encodedSignature = Buffer.from(signature).toString("base64url");
  const completePayload = {
    challenge_id: challengeBody.challenge_id,
    challenge: challengeBody.challenge,
    public_key_jwk: publicJwk,
    signature: encodedSignature
  };
  const completeRequest = () => new Request("https://example.test/api/security/device/enroll/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(completePayload)
  });

  const completed = await handleDeviceTrustRoute(completeRequest(), { DB }, auth, tenantContext, identityCheck);
  assert.equal(completed.status, 201);
  const completedBody = await completed.json();
  assert.equal(completedBody.proof_of_possession, "verified");
  assert.equal(completedBody.mission_presence, "still_blocked_until_per_mission_proof_is_implemented");
  assert.equal(state.credentials.length, 1);
  const storedKey = JSON.parse(state.credentials[0].public_key_jwk);
  assert.equal(storedKey.d, undefined);

  const replay = await handleDeviceTrustRoute(completeRequest(), { DB }, auth, tenantContext, identityCheck);
  assert.equal(replay.status, 409);
  assert.equal(state.credentials.length, 1);

  const otherTenant = await handleDeviceTrustRoute(
    new Request("https://example.test/api/security/device/list"),
    { DB },
    auth,
    { ok: true, tenant: { id: "tenant-2" } },
    identityCheck
  );
  assert.equal(otherTenant.status, 200);
  assert.deepEqual((await otherTenant.json()).devices, []);

  const revoke = await handleDeviceTrustRoute(
    new Request("https://example.test/api/security/device/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id: completedBody.device.id })
    }),
    { DB },
    auth,
    tenantContext,
    identityCheck
  );
  assert.equal(revoke.status, 200);
  assert.equal(state.credentials[0].status, "revoked");
});

test("revoked device key cannot be silently re-enrolled", async () => {
  const { DB, state } = createDeviceTrustDb();
  const auth = { user: { id: "intervenant-1", role: "intervenant" }, session_id: "session-1" };
  const tenantContext = { ok: true, tenant: { id: "tenant-1" } };
  const identityCheck = async () => ({ status: "verified" });
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]
  );
  const publicJwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);

  async function enrollOnce() {
    const challengeResponse = await handleDeviceTrustRoute(
      new Request("https://example.test/api/security/device/enroll/challenge", { method: "POST", body: "{}" }),
      { DB }, auth, tenantContext, identityCheck
    );
    assert.equal(challengeResponse.status, 201);
    const challenge = await challengeResponse.json();
    const signature = await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(challenge.signing_message)
    );
    return handleDeviceTrustRoute(
      new Request("https://example.test/api/security/device/enroll/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          challenge: challenge.challenge,
          public_key_jwk: publicJwk,
          signature: Buffer.from(signature).toString("base64url")
        })
      }),
      { DB }, auth, tenantContext, identityCheck
    );
  }

  const first = await enrollOnce();
  assert.equal(first.status, 201);
  const deviceId = (await first.json()).device.id;
  const revoked = await handleDeviceTrustRoute(
    new Request("https://example.test/api/security/device/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id: deviceId })
    }),
    { DB }, auth, tenantContext, identityCheck
  );
  assert.equal(revoked.status, 200);

  const reEnroll = await enrollOnce();
  assert.equal(reEnroll.status, 409);
  assert.equal((await reEnroll.json()).error, "DEVICE_ENROLLMENT_CONFLICT");
  assert.equal(state.credentials.length, 1);
  assert.equal(state.credentials[0].status, "revoked");
});
