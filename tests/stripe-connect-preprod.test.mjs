import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";
import { stripePost } from "../src/stripe.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function rateLimitDb() {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async run() { return { meta: { changes: 1 } }; },
        async first() {
          if (sql.includes("RETURNING request_count")) return { request_count: 1 };
          return null;
        }
      };
    }
  };
}

async function stripeSignature(secret, timestamp, body) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(timestamp + "." + body)));
  return Array.from(mac, x => x.toString(16).padStart(2, "0")).join("");
}

test("payment config never exposes a Stripe publishable key before explicit test onboarding approval", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/config"), {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
    STRIPE_CONNECT_ONBOARDING_ENABLED: "true"
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stripe_publishable_key, null);
  assert.equal(body.connect_onboarding_ready, false);
});

test("payment config exposes only the publishable key after both explicit flags and matching test keys", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/config"), {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    STRIPE_DASHBOARD: "full",
    STRIPE_FEES_COLLECTOR: "stripe",
    STRIPE_LOSSES_COLLECTOR: "stripe",
    APP_BASE_URL: "https://prochelia.pages.dev",
    STRIPE_CONNECT_ONBOARDING_ENABLED: "true",
    STRIPE_CONNECT_ONBOARDING_APPROVED: "true"
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stripe_publishable_key, "pk_test_placeholder");
  assert.equal(body.connect_onboarding_ready, true);
  assert.equal(JSON.stringify(body).includes("sk_test_placeholder"), false);
  assert.equal(JSON.stringify(body).includes("whsec_placeholder"), false);
});

test("Connect onboarding route is wired but disabled without explicit approval and creates no external request", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/onboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account_token: "acctok_test_12345678", stripe_terms_accepted: true })
  }), {
    DB: rateLimitDb(),
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder"
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "STRIPE_CONNECT_ONBOARDING_DISABLED_OR_NOT_APPROVED");
});

test("Stripe Connect webhook rejects unsupported financial event types rather than acknowledging them", async () => {
  const secret = "whsec_placeholder";
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify({ id: "evt_financial_unsupported", type: "payment_intent.succeeded", data: { object: { id: "pi_test" } } });
  const signature = await stripeSignature(secret, timestamp, raw);
  const response = await worker.fetch(new Request("https://api.test/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature },
    body: raw
  }), {
    DB: rateLimitDb(),
    PAYMENT_PROVIDER: "stripe",
    STRIPE_WEBHOOK_SECRET: secret
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "STRIPE_EVENT_NOT_SUPPORTED_BY_CONNECT_WEBHOOK");
});

test("Stripe API helper refuses non-allowlisted paths and missing idempotency", async () => {
  await assert.rejects(
    stripePost({ STRIPE_SECRET_KEY: "sk_test_placeholder" }, "v1/payment_intents", {}, "idem-test"),
    /STRIPE_PATH_NOT_ALLOWED/
  );
  await assert.rejects(
    stripePost({ STRIPE_SECRET_KEY: "sk_test_placeholder" }, "v2/core/accounts", {}, ""),
    /STRIPE_IDEMPOTENCY_KEY_REQUIRED/
  );
});
