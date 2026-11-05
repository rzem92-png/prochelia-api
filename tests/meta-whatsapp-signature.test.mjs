import test from "node:test";
import assert from "node:assert/strict";
import { verifyMetaWhatsAppSignature } from "../src/security/meta-whatsapp-signature.js";

const appSecret = "meta-test-app-secret";
const rawBody = '{"object":"whatsapp_business_account","entry":[]}';

async function signature(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return "sha256=" + Array.from(new Uint8Array(mac), b => b.toString(16).padStart(2, "0")).join("");
}

test("accepts valid Meta signature for exact raw payload", async () => {
  const sig = await signature(appSecret, rawBody);
  assert.deepEqual(await verifyMetaWhatsAppSignature({ appSecret, rawBody, signature: sig }), { ok: true });
});

test("rejects raw body tampering", async () => {
  const sig = await signature(appSecret, rawBody);
  assert.equal((await verifyMetaWhatsAppSignature({ appSecret, rawBody: rawBody + " ", signature: sig })).reason, "SIGNATURE_MISMATCH");
});

test("rejects wrong app secret", async () => {
  const sig = await signature(appSecret, rawBody);
  assert.equal((await verifyMetaWhatsAppSignature({ appSecret: "wrong-secret", rawBody, signature: sig })).reason, "SIGNATURE_MISMATCH");
});

test("rejects malformed signature and missing inputs", async () => {
  assert.equal((await verifyMetaWhatsAppSignature({ appSecret, rawBody, signature: "sha256=bad" })).reason, "INVALID_SIGNATURE_FORMAT");
  assert.equal((await verifyMetaWhatsAppSignature({ appSecret: "", rawBody, signature: "sha256=" + "0".repeat(64) })).reason, "MALFORMED");
});
