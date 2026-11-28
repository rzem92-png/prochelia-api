import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const cookie = "prochelia_session=test-session";
function makeDB(role = "gerante", failSelect = false) {
  let selectCalls = 0;
  let batchCalls = 0;
  const db = {
    prepare(sql) {
      return {
        sql, params: [],
        bind(...params) { this.params = params; return this; },
        async first() {
          if (sql.includes("FROM sessions s")) {
            return {
              id: "manager-test-id", role, email: "manager@example.test",
              first_name: "Test", last_name: "Manager", phone: null,
              status: "active", created_at: "2026-01-01", updated_at: "2026-01-01",
              session_id: "session-1"
            };
          }
          throw new Error("unexpected query");
        },
        async all() {
          if (sql.includes("FROM background_jobs")) {
            selectCalls++;
            if (failSelect) throw new Error("private D1 error");
            return { results: [{ id: "private-job-id", stale_marker: "2000-01-01 00:00:00" }] };
          }
          throw new Error("unexpected query");
        }
      };
    },
    async batch(statements) {
      batchCalls++;
      return statements.map(statement => ({
        meta: { changes: statement.sql.includes("UPDATE background_jobs") ? 1 : 1 }
      }));
    },
    get selectCalls() { return selectCalls; },
    get batchCalls() { return batchCalls; }
  };
  return db;
}

test("stale-job quarantine requires authenticated manager role", async () => {
  const db = makeDB();
  const noSession = await worker.fetch(new Request("https://preview.example/api/jobs/reconcile-stale", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "QUARANTINE_STALE_JOBS" })
  }), { DB: db });
  assert.equal(noSession.status, 401);
  assert.equal(db.selectCalls, 0);
  const client = await worker.fetch(new Request("https://preview.example/api/jobs/reconcile-stale", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "QUARANTINE_STALE_JOBS" })
  }), { DB: makeDB("client") });
  assert.equal(client.status, 403);
});

test("invalid confirmation never reads or changes the queue", async () => {
  const db = makeDB();
  const response = await worker.fetch(new Request("https://preview.example/api/jobs/reconcile-stale", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "YES" })
  }), { DB: db });
  assert.equal(response.status, 400);
  assert.equal(db.selectCalls, 0);
  assert.equal(db.batchCalls, 0);
});

test("manager action quarantines only a summary and does not expose job IDs", async () => {
  const db = makeDB();
  const response = await worker.fetch(new Request("https://preview.example/api/jobs/reconcile-stale", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "QUARANTINE_STALE_JOBS", staleMinutes: 120 })
  }), { DB: db });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const body = await response.json();
  assert.equal(body.automaticRetry, false);
  assert.equal(body.humanReconciliationRequired, true);
  assert.equal(body.quarantined, 1);
  assert.equal(db.selectCalls, 1);
  assert.equal(db.batchCalls, 1);
  assert.equal(JSON.stringify(body).includes("private-job-id"), false);
});

test("database errors return generic 503 without leaking details", async () => {
  const db = makeDB("gerante", true);
  const response = await worker.fetch(new Request("https://preview.example/api/jobs/reconcile-stale", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "QUARANTINE_STALE_JOBS" })
  }), { DB: db });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, "STALE_JOB_QUARANTINE_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(body), /private D1 error/);
});

test("invalid stale threshold is rejected before querying D1", async () => {
  const db = makeDB();
  const response = await worker.fetch(new Request("https://preview.example/api/jobs/reconcile-stale", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "QUARANTINE_STALE_JOBS", staleMinutes: 30 })
  }), { DB: db });
  assert.equal(response.status, 400);
  assert.equal(db.selectCalls, 0);
  assert.equal(db.batchCalls, 0);
});

test("oversized JSON request is rejected before queue access", async () => {
  const db = makeDB();
  const response = await worker.fetch(new Request("https://preview.example/api/jobs/reconcile-stale", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "QUARANTINE_STALE_JOBS", extra: "x".repeat(2048) })
  }), { DB: db });
  assert.equal(response.status, 413);
  assert.equal(db.selectCalls, 0);
  assert.equal(db.batchCalls, 0);
});
