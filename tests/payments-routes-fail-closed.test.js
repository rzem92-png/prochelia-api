import test from "node:test";
import assert from "node:assert/strict";
import {
  paymentsConfigured,
  paymentOnboard,
  createMissionPayment,
  payoutRequest
} from "../src/index.js";

function authenticatedEnv(role) {
  const statements = [];
  const writes = [];
  const env = {
    PAYMENT_PROVIDER: "stripe",
    PAYMENT_WEBHOOK_SECRET: "synthetic-webhook-secret",
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind(...values) {
            return {
              async first() {
                assert.match(sql, /FROM sessions s\s+JOIN users u/);
                assert.equal(values.length, 1);
                return {
                  id: "synthetic-user",
                  role,
                  email: "user@example.test",
                  first_name: "Synthetic",
                  last_name: "User",
                  phone: null,
                  status: "active",
                  created_at: "2026-01-01 00:00:00",
                  updated_at: "2026-01-01 00:00:00",
                  session_id: "synthetic-session"
                };
              },
              async run() {
                writes.push(sql);
                throw new Error("Unexpected financial D1 write");
              },
              async all() {
                throw new Error("Unexpected D1 read");
              }
            };
          },
          async run() {
            writes.push(sql);
            throw new Error("Unexpected financial D1 write");
          }
        };
      }
    }
  };
  return { env, statements, writes };
}

function request(path, body) {
  return new Request("https://api.example.test" + path, {
    method: "POST",
    headers: {
      cookie: "prochelia_session=synthetic-session-token",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("provider name and webhook secret never enable payments", () => {
  assert.equal(paymentsConfigured({
    PAYMENT_PROVIDER: "stripe",
    PAYMENT_WEBHOOK_SECRET: "synthetic-webhook-secret"
  }), false);
});

test("Stripe test/live key-shaped configuration never enables a PSP adapter", () => {
  for (const env of [
    { PAYMENT_PROVIDER: "stripe", PAYMENT_WEBHOOK_SECRET: "whsec_synthetic", STRIPE_SECRET_KEY: "sk_test_synthetic" },
    { PAYMENT_PROVIDER: "stripe", PAYMENT_WEBHOOK_SECRET: "whsec_synthetic", STRIPE_SECRET_KEY: "sk_live_synthetic" }
  ]) {
    assert.equal(paymentsConfigured(env), false);
  }
});

test("onboarding, mission charge and payout all fail closed before D1 writes", async () => {
  const cases = [
    {
      handler: paymentOnboard,
      role: "intervenant",
      path: "/api/payments/onboard",
      error: "PSP_ONBOARDING_NOT_IMPLEMENTED",
      body: { provider_account_id: "acct_caller_controlled" }
    },
    {
      handler: createMissionPayment,
      role: "gerante",
      path: "/api/payments/mission",
      error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      body: { mission_id: "synthetic-mission", gross_eur: "100.00" }
    },
    {
      handler: payoutRequest,
      role: "intervenant",
      path: "/api/payments/payout",
      error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      body: { amount_eur: "50.00", provider_account_id: "acct_caller_controlled" }
    }
  ];

  for (const item of cases) {
    const { env, statements, writes } = authenticatedEnv(item.role);
    const response = await item.handler(request(item.path, item.body), env);
    assert.equal(response.status, 503, item.path);
    assert.equal((await response.json()).error, item.error, item.path);
    assert.equal(statements.length, 1, "only the authenticated session lookup is allowed");
    assert.equal(writes.length, 0, "no account, wallet, transaction or payout row may be written");
  }
});
