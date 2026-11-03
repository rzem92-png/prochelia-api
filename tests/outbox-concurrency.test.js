import test from "node:test";
import assert from "node:assert/strict";
import { claimActionExecution, quarantineStaleOutboxActions, incrementRateLimitCounter, productionSubjectHash } from "../src/index.js";

function fakeDB(initialStatus = "PENDING") {
  const state = { status: initialStatus };
  return {
    state,
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async run() {
          if (sql.includes("UPDATE action_outbox") && sql.includes("status='RUNNING'")) {
            if (state.status === "PENDING" && params[0] === "action-1") {
              state.status = "RUNNING";
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          throw new Error("Unexpected SQL in test: " + sql);
        },
        async first() {
          if (sql.includes("SELECT status FROM action_outbox")) return { status: state.status };
          throw new Error("Unexpected SQL in test: " + sql);
        }
      };
    }
  };
}

test("only one concurrent caller can claim a pending outbox action", async () => {
  const DB = fakeDB();
  const env = { DB };
  const results = await Promise.all([
    claimActionExecution(env, "action-1"),
    claimActionExecution(env, "action-1")
  ]);
  assert.equal(results.filter(x => x.claimed).length, 1);
  assert.equal(results.filter(x => !x.claimed && x.status === "RUNNING").length, 1);
  assert.equal(DB.state.status, "RUNNING");
});

test("completed outbox action cannot be claimed again", async () => {
  const DB = fakeDB("DONE");
  const result = await claimActionExecution({ DB }, "action-1");
  assert.deepEqual(result, { claimed: false, status: "DONE" });
  assert.equal(DB.state.status, "DONE");
});

test("unknown outbox action fails closed", async () => {
  const DB = fakeDB("NOT_FOUND");
  const result = await claimActionExecution({ DB }, "missing");
  assert.deepEqual(result, { claimed: false, status: "NOT_FOUND" });
});

test("stale RUNNING actions are quarantined rather than retried", async () => {
  let sqlSeen = "";
  const DB = {
    prepare(sql) {
      sqlSeen = sql;
      return {
        async run() { return { meta: { changes: 2 } }; }
      };
    }
  };
  const count = await quarantineStaleOutboxActions({ DB });
  assert.equal(count, 2);
  assert.match(sqlSeen, /status='UNCERTAIN'/);
  assert.match(sqlSeen, /status='RUNNING'/);
  assert.match(sqlSeen, /datetime\('now','-5 minutes'\)/);
  assert.match(sqlSeen, /Manual reconciliation required/);
});

test("rate-limit increments use one atomic upsert with RETURNING", async () => {
  let captured = "";
  const DB = {
    prepare(sql) {
      captured = sql;
      return {
        bind(...args) {
          assert.equal(args[1], "bucket");
          assert.equal(args[2], "subject");
          assert.equal(args[3], "window");
          return this;
        },
        async first() { return { request_count: 21 }; }
      };
    }
  };
  const count = await incrementRateLimitCounter({ DB }, "bucket", "subject", "window");
  assert.equal(count, 21);
  assert.match(captured, /ON CONFLICT\(bucket,subject_hash,window_start\)/);
  assert.match(captured, /request_count=security_rate_limits\.request_count\+1/);
  assert.match(captured, /RETURNING request_count/);
});

test("rate-limit counter fails closed on invalid database return", async () => {
  const DB = { prepare() { return { bind() { return this; }, async first() { return null; } }; } };
  await assert.rejects(
    incrementRateLimitCounter({ DB }, "b", "s", "w"),
    /RATE_LIMIT_COUNTER_INVALID/
  );
});

test("rate-limit identity ignores spoofable X-Forwarded-For", async () => {
  const a = new Request("https://example.test/api/auth/login", {
    headers: { "CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "1.1.1.1" }
  });
  const b = new Request("https://example.test/api/auth/login", {
    headers: { "CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "8.8.8.8" }
  });
  const hashA = await productionSubjectHash(a, "/api/auth/login");
  const hashB = await productionSubjectHash(b, "/api/auth/login");
  assert.equal(hashA, hashB);
});
