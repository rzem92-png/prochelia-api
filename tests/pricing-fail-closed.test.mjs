import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

test("authenticated pricing quote fails closed without DDL or financial writes", async () => {
  const statements = [];
  const token = "pricing-security-test-session-token";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Buffer.from(digest).toString("base64url");
  const DB = {
    prepare(sql) {
      statements.push(sql);
      return {
        bind() { return this; },
        async first() {
          return {
            id: "user-test",
            role: "gerante",
            email: "test@example.invalid",
            first_name: "Test",
            last_name: "Manager",
            phone: null,
            status: "active",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            session_id: "session-test",
            session_active_tenant_id: null
          };
        },
        async all() { return { results: [] }; },
        async run() { return { success: true, meta: { changes: 0 } }; }
      };
    }
  };
  assert.ok(tokenHash.length > 20);
  const request = new Request("https://api.example.test/api/pricing/quote", {
    method: "POST",
    headers: {
      origin: "https://4c3cec36.prochelia.pages.dev",
      cookie: `prochelia_session=${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      base_price_cents: 1,
      phase: "PRODUCTION",
      client_type: "B2B",
      platform_fee_percent: 99,
      discount_cents: 999999
    })
  });
  const response = await worker.fetch(request, {
    DB,
    CORS_ORIGIN: "https://4c3cec36.prochelia.pages.dev"
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PRICING_POLICY_NOT_PRODUCTION_READY");
  assert.ok(statements.every(sql => !/^\\s*(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\\b/i.test(sql)),
    "pricing fail-closed path must not execute DDL or database writes");
  assert.ok(statements.some(sql => /^\\s*SELECT\\b/i.test(sql)),
    "authenticated route must validate the session");
});
