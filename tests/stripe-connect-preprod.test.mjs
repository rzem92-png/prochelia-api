import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";
import { stripePost } from "../src/stripe.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

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
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder"
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "STRIPE_CONNECT_ONBOARDING_DISABLED_OR_NOT_APPROVED");
});

test("Stripe Connect webhook rejects unsupported financial event types rather than acknowledging them", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": "invalid" },
    body: JSON.stringify({ id: "evt_financial_unsupported", type: "payment_intent.succeeded", data: { object: { id: "pi_test" } } })
  }), {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder"
  });
  assert.equal(response.status, 401);
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
