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
            return { success: true, results: [] };
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


test("payment status fails closed when schema metadata reports failure with partial wallet rows", async () => {
  let walletReads = 0;
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (/FROM sessions s/.test(sql)) {
                  return {
                    id: "synthetic-user", role: "intervenant", email: "synthetic@example.test",
                    first_name: "Synthetic", last_name: "User", phone: null, status: "active",
                    created_at: "2026-01-01 00:00:00", updated_at: "2026-01-01 00:00:00",
                    session_id: "synthetic-session"
                  };
                }
                if (/FROM wallets/.test(sql)) walletReads += 1;
                throw new Error("Financial table reads must not follow failed schema metadata");
              }
            };
          },
          async all() {
            return { success: false, results: [{ name: "wallets" }] };
          }
        };
      }
    }
  };
  const request = new Request("https://api.example.test/api/payments/status", {
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
  const response = await paymentStatus(request, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PAYMENT_STATUS_SCHEMA_UNAVAILABLE");
  assert.equal(walletReads, 0);
});

test("payment status fails closed when schema metadata lookup throws", async () => {
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (/FROM sessions s/.test(sql)) {
                  return {
                    id: "synthetic-user", role: "intervenant", email: "synthetic@example.test",
                    first_name: "Synthetic", last_name: "User", phone: null, status: "active",
                    created_at: "2026-01-01 00:00:00", updated_at: "2026-01-01 00:00:00",
                    session_id: "synthetic-session"
                  };
                }
                throw new Error("Unexpected financial read");
              }
            };
          },
          async all() { throw new Error("Synthetic D1 metadata outage"); }
        };
      }
    }
  };
  const request = new Request("https://api.example.test/api/payments/status", {
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
  const response = await paymentStatus(request, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PAYMENT_STATUS_SCHEMA_UNAVAILABLE");
});


test("payment status fails closed when D1 success status is missing", async () => {
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (/FROM sessions s/.test(sql)) {
                  return {
                    id: "synthetic-user", role: "intervenant", email: "synthetic@example.test",
                    first_name: "Synthetic", last_name: "User", phone: null, status: "active",
                    created_at: "2026-01-01 00:00:00", updated_at: "2026-01-01 00:00:00",
                    session_id: "synthetic-session"
                  };
                }
                throw new Error("Financial reads must not follow malformed D1 metadata");
              }
            };
          },
          async all() {
            return { results: [] };
          }
        };
      }
    }
  };
  const request = new Request("https://api.example.test/api/payments/status", {
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
  const response = await paymentStatus(request, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PAYMENT_STATUS_SCHEMA_UNAVAILABLE");
});
