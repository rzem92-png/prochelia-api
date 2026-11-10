import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";
import { stripePost, verifyStripeSignature } from "../src/stripe.js";

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

function authenticatedRateLimitDb() {
  return {
    prepare(sql) {
      const statement = rateLimitDb().prepare(sql);
      const first = statement.first;
      statement.first = async function () {
        if (sql.includes("FROM sessions s")) {
          return {
            id: "provider-user", role: "intervenant", email: "provider@example.test",
            first_name: "Test", last_name: "Provider", phone: null, status: "active",
            created_at: "2026-01-01 00:00:00", updated_at: "2026-01-01 00:00:00",
            session_id: "session-test"
          };
        }
        return first.call(this);
      };
      return statement;
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
    STRIPE_CONNECT_CHARGE_MODEL: "separate_charges_and_transfers",
    STRIPE_DASHBOARD: "express",
    STRIPE_FEES_COLLECTOR: "application",
    STRIPE_LOSSES_COLLECTOR: "application",
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

test("payment config rejects invalid Accounts v2 dashboard and responsibility combinations", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/config"), {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    STRIPE_CONNECT_CHARGE_MODEL: "separate_charges_and_transfers",
    STRIPE_DASHBOARD: "full",
    STRIPE_FEES_COLLECTOR: "stripe",
    STRIPE_LOSSES_COLLECTOR: "stripe",
    APP_BASE_URL: "https://prochelia.pages.dev",
    STRIPE_CONNECT_ONBOARDING_ENABLED: "true",
    STRIPE_CONNECT_ONBOARDING_APPROVED: "true"
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stripe_publishable_key, null);
  assert.equal(body.connect_onboarding_ready, false);
});

test("live Connect config requires a separate live approval in addition to onboarding approval", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/config"), {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_live_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_live_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    STRIPE_CONNECT_CHARGE_MODEL: "direct",
    STRIPE_DASHBOARD: "full",
    STRIPE_FEES_COLLECTOR: "stripe",
    STRIPE_LOSSES_COLLECTOR: "stripe",
    APP_BASE_URL: "https://prochelia.pages.dev",
    STRIPE_CONNECT_ONBOARDING_ENABLED: "true",
    STRIPE_CONNECT_ONBOARDING_APPROVED: "true",
    STRIPE_CONNECT_LIVE_ENABLED: "true"
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stripe_publishable_key, null);
  assert.equal(body.connect_onboarding_ready, false);
});

test("payment config stays closed until the charge model is explicitly selected", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/config"), {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    STRIPE_DASHBOARD: "express",
    STRIPE_FEES_COLLECTOR: "application",
    STRIPE_LOSSES_COLLECTOR: "application",
    APP_BASE_URL: "https://prochelia.pages.dev",
    STRIPE_CONNECT_ONBOARDING_ENABLED: "true",
    STRIPE_CONNECT_ONBOARDING_APPROVED: "true"
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.connect_charge_model, null);
  assert.equal(body.stripe_publishable_key, null);
  assert.equal(body.connect_onboarding_ready, false);
});

test("onboarding rejects missing charge model before contacting Stripe", async () => {
  const response = await worker.fetch(new Request("https://api.test/api/payments/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "prochelia_session=session-test" },
    body: JSON.stringify({ account_token: "acctok_test_12345678", stripe_terms_accepted: true })
  }), {
    DB: authenticatedRateLimitDb(),
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    STRIPE_DASHBOARD: "express",
    STRIPE_FEES_COLLECTOR: "application",
    STRIPE_LOSSES_COLLECTOR: "application",
    STRIPE_CONNECT_ONBOARDING_ENABLED: "true",
    STRIPE_CONNECT_ONBOARDING_APPROVED: "true"
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "STRIPE_CONNECT_NOT_CONFIGURED");
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

test("verified Connect transfer capability never enables bank payouts", async () => {
  const secret = "whsec_connect_test";
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify({
    id: "evt_connect_capability_test",
    type: "v2.core.account[requirements].updated",
    data: { object: { id: "acct_connecttest123" } }
  });
  const signature = await stripeSignature(secret, timestamp, raw);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  const payloadHash = btoa(String.fromCharCode(...digest)).split("+").join("-").split("/").join("_").replace(/=+$/g, "");
  const calls = [];
  const DB = {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (sql.includes("type='table'") && sql.includes("sqlite_master")) return { total: 9 };
          if (sql.includes("type='trigger'") && sql.includes("sqlite_master")) return { total: 16 };
          if (sql.includes("pragma_table_info('payment_accounts')")) return { total: 1 };
          if (sql.includes("RETURNING request_count")) return { request_count: 1 };
          if (sql.includes("SELECT processed,payload_hash,received_at")) {
            return { processed: 0, payload_hash: payloadHash, received_at: "2026-11-10 07:00:00" };
          }
          return null;
        },
        async run() {
          calls.push({ sql, args: this.args });
          return { meta: { changes: 1 } };
        }
      };
      return statement;
    },
    async batch(statements) {
      return Promise.all(statements.map(statement => statement.run()));
    }
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.stripe.com/v2/core/accounts/acct_connecttest123");
    assert.equal(init.headers.Authorization, "Bearer sk_test_connect");
    return new Response(JSON.stringify({
      id: "acct_connecttest123",
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } } }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://api.test/api/payments/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature },
      body: raw
    }), {
      DB,
      PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_connect",
      STRIPE_WEBHOOK_SECRET: secret
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.transfers_enabled, true);
    assert.equal(body.payouts_enabled, false);
    const accountUpdate = calls.find(call => call.sql.includes("UPDATE payment_accounts") && call.sql.includes("transfers_enabled=?") && call.sql.includes("payouts_enabled=?"));
    assert.ok(accountUpdate, "transfer and external payout capabilities must be persisted independently");
    assert.deepEqual(accountUpdate.args, [1, 0, "active", "submitted", "acct_connecttest123"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});



test("verified bank-payout capability never enables recipient transfers", async () => {
  const secret = "whsec_connect_test";
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify({
    id: "evt_connect_payout_only",
    type: "v2.core.account[requirements].updated",
    data: { object: { id: "acct_payoutonly123" } }
  });
  const signature = await stripeSignature(secret, timestamp, raw);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  const payloadHash = btoa(String.fromCharCode(...digest)).split("+").join("-").split("/").join("_").replace(/=+$/g, "");
  const calls = [];
  const DB = {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (sql.includes("type='table'") && sql.includes("sqlite_master")) return { total: 9 };
          if (sql.includes("type='trigger'") && sql.includes("sqlite_master")) return { total: 16 };
          if (sql.includes("pragma_table_info('payment_accounts')")) return { total: 1 };
          if (sql.includes("RETURNING request_count")) return { request_count: 1 };
          if (sql.includes("SELECT processed,payload_hash,received_at")) {
            return { processed: 0, payload_hash: payloadHash, received_at: "2026-11-10 07:00:00" };
          }
          return null;
        },
        async run() { calls.push({ sql, args: this.args }); return { meta: { changes: 1 } }; }
      };
      return statement;
    },
    async batch(statements) {
      return Promise.all(statements.map(statement => statement.run()));
    }
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.stripe.com/v2/core/accounts/acct_payoutonly123");
    assert.equal(init.headers.Authorization, "Bearer sk_test_connect");
    return new Response(JSON.stringify({
      id: "acct_payoutonly123",
      configuration: { recipient: { capabilities: { stripe_balance: {
        stripe_transfers: { status: "pending" },
        payouts: { status: "active" }
      } } } }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://api.test/api/payments/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature },
      body: raw
    }), {
      DB,
      PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_connect",
      STRIPE_WEBHOOK_SECRET: secret
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.transfers_enabled, false);
    assert.equal(body.payouts_enabled, true);
    const accountUpdate = calls.find(call => call.sql.includes("UPDATE payment_accounts") && call.sql.includes("transfers_enabled=?") && call.sql.includes("payouts_enabled=?"));
    assert.ok(accountUpdate, "recipient transfers and bank payouts must be persisted independently");
    assert.deepEqual(accountUpdate.args, [0, 1, "pending", "required", "acct_payoutonly123"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Stripe webhook signature verification rejects stale and malformed signatures", async () => {
  const secret = "whsec_signature_unit_test";
  const now = 1_800_000_000;
  const body = JSON.stringify({ id: "evt_signature_test", type: "v2.core.account[requirements].updated" });
  const valid = await stripeSignature(secret, now, body);
  assert.equal(await verifyStripeSignature("t=" + now + ",v1=" + valid, secret, body, now), true);
  assert.equal(await verifyStripeSignature("t=" + (now - 301) + ",v1=" + valid, secret, body, now), false);
  assert.equal(await verifyStripeSignature("t=" + now + ",v1=not-a-hex-signature", secret, body, now), false);
  assert.equal(await verifyStripeSignature("v1=" + valid, secret, body, now), false);
  assert.equal(await verifyStripeSignature("t=" + now + ",v1=" + valid, "", body, now), false);
  assert.equal(await verifyStripeSignature("t=" + now + ",v1=" + valid, secret, body + " ", now), false);
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
