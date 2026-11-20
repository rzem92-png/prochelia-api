import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  copilotRecommend,
  createOperationalCase,
  approveOperationalCase,
  executeOperationalCase,
  queueAction,
  executeQueuedAction,
  operationalExecute,
  processBackgroundJobs
} from "../src/index.js";

const managerRow = {
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
                return managerRow;
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

function managerRequest(path, body = {}) {
  return new Request("https://api.example.test" + path, {
    method: "POST",
    headers: {
      cookie: "prochelia_session=synthetic-session-token",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("Copilot recommendations are proposals only for simple and sensitive cases", async () => {
  for (const caseType of ["panne_application", "absence_intervenant", "reclamation_client"]) {
    const recommendation = await copilotRecommend({}, {
      caseType,
      impact: "LOW",
      context: { mission_id: "untrusted-mission" }
    });
    assert.equal(recommendation.action, "ANALYZE_AND_PROPOSE");
    assert.equal(recommendation.mode, "MANAGER_APPROVAL");
    assert.equal(recommendation.solution.automatic, false);
  }
});

test("central case executor refuses before reading or writing D1", async () => {
  let calls = 0;
  const env = { DB: { prepare() { calls += 1; throw new Error("D1 must not be touched"); } } };
  assert.deepEqual(
    await executeOperationalCase(env, "case-1", "manager-1", false),
    { ok: false, error: "TENANT_SCOPED_EXECUTION_NOT_IMPLEMENTED" }
  );
  assert.equal(calls, 0);
});

test("outbox creation and execution helpers are independently fail-closed", async () => {
  let calls = 0;
  const env = { DB: { prepare() { calls += 1; throw new Error("D1 must not be touched"); } } };
  assert.deepEqual(
    await queueAction(env, "ASSIGN_REPLACEMENT", "MISSION", "mission-1", { intervenant_id: "other" }, "idem-1"),
    { ok: false, error: "TENANT_SCOPED_EXECUTION_NOT_IMPLEMENTED" }
  );
  assert.deepEqual(
    await executeQueuedAction(env, {
      id: "action-1",
      action_type: "ASSIGN_REPLACEMENT",
      payload_json: JSON.stringify({ intervenant_id: "other" })
    }),
    { ok: false, error: "TENANT_SCOPED_EXECUTION_NOT_IMPLEMENTED" }
  );
  assert.equal(calls, 0);
});

test("legacy operational execution route returns 503 before schema or business writes", async () => {
  const { env, statements, writes } = managerEnv();
  const response = await operationalExecute(managerRequest("/api/ops/case/execute", {
    case_id: "case-1",
    actions: [{ type: "ASSIGN_REPLACEMENT", entity_id: "mission-1", intervenant_id: "other" }]
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "TENANT_SCOPED_EXECUTION_NOT_IMPLEMENTED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is allowed");
  assert.equal(writes.length, 0);
});

test("case creation and approval remain disabled before any business write", async () => {
  for (const [handler, path, expected] of [
    [createOperationalCase, "/api/cases", "TENANT_SCOPED_CASE_CREATION_NOT_IMPLEMENTED"],
    [approveOperationalCase, "/api/cases/approve", "TENANT_SCOPED_APPROVAL_NOT_IMPLEMENTED"]
  ]) {
    const { env, statements, writes } = managerEnv();
    const response = await handler(managerRequest(path, { case_id: "case-1", case_type: "panne_application" }), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, expected);
    assert.equal(statements.length, 1, "only the authenticated session lookup is allowed");
    assert.equal(writes.length, 0);
  }
});


test("background job endpoint remains proposal-only and performs no D1 writes", async () => {
  const { env, statements, writes } = managerEnv();
  const response = await processBackgroundJobs(managerRequest("/api/jobs/process"), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "BACKGROUND_EXECUTOR_NOT_IMPLEMENTED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is allowed");
  assert.equal(writes.length, 0);
});

test("action outbox route is blocked before schema setup or outbox reads", async () => {
  const { env, statements, writes } = managerEnv();
  const response = await worker.fetch(managerRequest("/api/ops/outbox/process"), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "TENANT_SCOPED_EXECUTION_NOT_IMPLEMENTED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is allowed");
  assert.equal(writes.length, 0);
});
