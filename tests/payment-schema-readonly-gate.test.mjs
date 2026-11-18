import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { paymentSchemaReady } from "../src/index.js";

const REQUIRED = [
  "payment_accounts",
  "wallets",
  "payment_transactions",
  "payout_requests",
  "payment_webhook_events",
  "payment_disputes",
  "payment_reconciliation",
  "payment_audit",
  "payment_wallet_ledger"
];

test("payment schema readiness is a read-only metadata query", async () => {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        calls.push({ method: "prepare", sql });
        return {
          bind(...values) {
            calls.push({ method: "bind", values });
            return {
              async all() {
                calls.push({ method: "all" });
                return { success: true, results: REQUIRED.map(name => ({ name })) };
              },
              async run() {
                throw new Error("Payment schema readiness must never write");
              }
            };
          }
        };
      }
    }
  };

  assert.equal(await paymentSchemaReady(env), true);
  assert.equal(calls.filter(call => call.method === "prepare").length, 1);
  assert.equal(calls.filter(call => call.method === "bind").length, 1);
  assert.equal(calls.filter(call => call.method === "all").length, 1);
  const query = calls.find(call => call.method === "prepare").sql;
  assert.match(query, /^SELECT name FROM sqlite_master/);
  assert.doesNotMatch(query, /CREATE|INSERT|UPDATE|DELETE|DROP/i);
  assert.deepEqual(calls.find(call => call.method === "bind").values, REQUIRED);
});

test("payment schema readiness fails closed when any required table is missing", async () => {
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /^SELECT name FROM sqlite_master/);
        return {
          bind(...values) {
            return {
              async all() {
                return { success: true, results: values.slice(0, -1).map(name => ({ name })) };
              }
            };
          }
        };
      }
    }
  };
  assert.equal(await paymentSchemaReady(env), false);
});

test("payment schema readiness fails closed without D1", async () => {
  assert.equal(await paymentSchemaReady({}), false);
});

test("payment request handlers no longer contain a runtime DDL schema helper", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ensurePaymentSchema/);
  assert.match(source, /paymentSchemaReady\(env\)/);
});

test("payment schema readiness fails closed when the metadata query fails", async () => {
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async all() {
                throw new Error("synthetic D1 metadata failure");
              }
            };
          }
        };
      }
    }
  };
  assert.equal(await paymentSchemaReady(env), false);
});


test("payment schema readiness fails closed on an unsuccessful metadata response even if rows are present", async () => {
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async all() {
                return { success: false, results: REQUIRED.map(name => ({ name })) };
              }
            };
          }
        };
      }
    }
  };
  assert.equal(await paymentSchemaReady(env), false);
});


test("payment schema readiness fails closed when D1 success status is missing", async () => {
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async all() {
                return { results: REQUIRED.map(name => ({ name })) };
              }
            };
          }
        };
      }
    }
  };
  assert.equal(await paymentSchemaReady(env), false);
});
