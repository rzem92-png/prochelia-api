import test from "node:test";
import assert from "node:assert/strict";
import { paymentStatus } from "../src/index.js";

test("payment status is read-only and does not invent a zero wallet when schema is absent", async () => {
  const statements = [];
  const writes = [];
  const env = {
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind() {
            return {
              async first() {
                if (/FROM sessions s/.test(sql)) {
                  return {
                    id: "synthetic-user",
                    role: "intervenant",
                    email: "synthetic@example.test",
                    first_name: "Synthetic",
                    last_name: "User",
                    phone: null,
                    status: "active",
                    created_at: "2026-01-01 00:00:00",
                    updated_at: "2026-01-01 00:00:00",
                    session_id: "synthetic-session"
                  };
                }
                throw new Error("Unexpected read");
              }
            };
          },
          async all() {
            assert.match(sql, /sqlite_master/);
            return { results: [] };
          },
          async run() {
            writes.push(sql);
            throw new Error("GET /payments/status must not write");
          }
        };
      }
    }
  };
  const request = new Request("https://api.example.test/api/payments/status", {
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
  const response = await paymentStatus(request, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.payments_configured, false);
  assert.equal(body.data_status, "NOT_INITIALIZED");
  assert.equal(body.wallet, null);
  assert.equal(body.payout_account, null);
  assert.equal(body.pending_payouts, null);
  assert.equal(statements.length, 2, "only session lookup and schema metadata read are allowed");
  assert.equal(writes.length, 0);
});
