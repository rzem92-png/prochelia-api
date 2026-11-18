import test from "node:test";
import assert from "node:assert/strict";
import { pricingQuote } from "../src/index.js";

function managerEnv() {
  const statements = [];
  const writes = [];
  const env = {
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
                  id: "manager-1",
                  role: "gerante",
                  email: "manager@example.test",
                  first_name: "Test",
                  last_name: "Manager",
                  phone: null,
                  status: "active",
                  created_at: "2026-01-01 00:00:00",
                  updated_at: "2026-01-01 00:00:00",
                  session_id: "session-1"
                };
              },
              async run() {
                writes.push(sql);
                throw new Error("Unexpected D1 write in fail-closed test");
              },
              async all() {
                throw new Error("Unexpected D1 read in fail-closed test");
              }
            };
          },
          async run() {
            writes.push(sql);
            throw new Error("Unexpected D1 write in fail-closed test");
          }
        };
      }
    }
  };
  return { env, statements, writes };
}

function managerRequest(path, method, body) {
  const init = {
    method,
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  };
  if (body !== null) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request("https://api.example.test" + path, init);
}

test("pricingQuote returns 503 before business data reads or writes", async () => {
  const { env, statements, writes } = managerEnv();
  const response = await pricingQuote(managerRequest("/api/pricing/quote", "POST", {"base_price_cents":100,"commission_rate":0.99,"provider_fee_cents":0}), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "SERVER_PRICING_POLICY_NOT_READY");
  assert.equal(statements.length, 1, "only the authenticated session lookup is allowed");
  assert.equal(writes.length, 0);
});
