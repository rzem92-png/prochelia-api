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
