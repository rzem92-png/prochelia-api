import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-task-lifecycle.js";
import "../src/nexus-audit-ledger.js";
import "../src/nexus-task-audit-bridge.js";
import "../src/nexus-task-audit-commit.js";
import "../src/nexus-d1-task-audit-reader.js";

const lifecycle = globalThis.ProcheliaNexusTaskLifecycle;
const auditApi = globalThis.ProcheliaNexusAuditLedger;
const bridge = globalThis.ProcheliaNexusTaskAuditBridge;
const commitPair = globalThis.ProcheliaNexusTaskAuditCommit.commitTaskTransitionWithAudit;
const reader = globalThis.ProcheliaNexusD1TaskAuditReader.loadTaskAuditPair;

async function fixture({ tenantId = "tenant-a", environment = "preview", taskId = "reader-task-01" } = {}) {
  const created = lifecycle.createTask({
    taskId, tenantId, environment, agentId: "ops-agent", taskType: "OPS_REVIEW",
    riskClass: "OPS", idempotencyKey: "reader-idempotency-key-01",
    objective: "Read persisted Preview state", correlationId: "reader-correlation-01",
    maxAttempts: 2, priority: 4
  }, Date.parse("2026-11-27T16:00:00.000Z"));
  assert.equal(created.ok, true);
  const previousTask = created.task;
  const previousLedger = auditApi.createLedger({ environment, tenantId }).ledger;
  const transition = {
    eventId: "reader-event-01", actorId: "planner-01", actorType: "AGENT",
    from: "RECEIVED", to: "PLANNED", expectedRevision: 0,
    occurredAt: "2026-11-27T16:00:01.000Z",
    metadata: { planRef: "reader-plan-01", plannerId: "planner-01", dependencies: [] }
  };
  const pair = await commitPair({ task: previousTask, transition, ledger: previousLedger, lifecycleApi: lifecycle, bridgeApi: bridge, auditApi });
  assert.equal(pair.ok, true);
  const scope = tenantId ?? "__GLOBAL__";
  const rows = {
    snapshot: { task_id: taskId, tenant_id: tenantId, scope_key: scope, environment, revision: pair.task.revision, state: pair.task.state, snapshot_json: JSON.stringify(pair.task) },
    taskRows: [{ event_id: pair.transitionEvent.eventId, task_id: taskId, tenant_id: tenantId, scope_key: scope, environment, revision: pair.transitionEvent.revision, event_json: JSON.stringify(pair.transitionEvent) }],
    head: { scope_key: scope, tenant_id: tenantId, environment, revision: pair.ledger.revision, head_hash: pair.ledger.headHash },
    auditRows: pair.ledger.events.map(event => ({ event_id: event.eventId, scope_key: scope, tenant_id: tenantId, environment, sequence: event.sequence, previous_hash: event.previousHash, hash: event.hash, event_json: JSON.stringify(event) }))
  };
  const DB = {
    calls: [],
    prepare(sql) {
      return { sql, bind(...bindings) {
        return {
          sql, bindings,
          async first() {
            DB.calls.push(sql);
            if (sql.includes("nexus_task_snapshots")) return rows.snapshot;
            if (sql.includes("nexus_audit_ledger_heads")) return rows.head;
            return null;
          },
          async all() {
            DB.calls.push(sql);
            if (sql.includes("nexus_task_events")) return { results: rows.taskRows };
            if (sql.includes("nexus_audit_ledger_events")) return { results: rows.auditRows };
            return { results: [] };
          }
        };
      }};
    }
  };
  return { DB, rows, task: pair.task, ledger: pair.ledger, tenantId, environment, taskId };
}
function input(f, overrides = {}) { return { DB: f.DB, taskId: f.taskId, tenantId: f.tenantId, environment: f.environment, auditApi, ...overrides }; }

test("reconstructs scoped D1 task state and verifies the complete audit hash chain", async () => {
  const f = await fixture();
  const result = await reader(input(f));
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.executionAllowed, false);
  assert.deepEqual(result.task, f.task);
  assert.deepEqual(result.ledger, f.ledger);
  assert.equal(result.proof.taskEvents, 1);
  assert.equal(result.proof.auditEvents, 1);
});

test("fails closed if snapshot and task event history disagree", async () => {
  const f = await fixture();
  f.rows.taskRows = [];
  assert.equal((await reader(input(f))).error, "TASK_SNAPSHOT_INVALID");
});

test("rejects a row returned outside the requested tenant scope", async () => {
  const f = await fixture();
  f.rows.snapshot = { ...f.rows.snapshot, tenant_id: "tenant-b", scope_key: "tenant-b" };
  assert.equal((await reader(input(f))).error, "TASK_SCOPE_MISMATCH");
});

test("rejects event metadata when stored columns and JSON disagree", async () => {
  const f = await fixture();
  f.rows.auditRows[0] = { ...f.rows.auditRows[0], hash: "f".repeat(64) };
  assert.equal((await reader(input(f))).error, "AUDIT_EVENT_INTEGRITY_FAILED");
});

test("rejects a head revision that does not match the persisted event count", async () => {
  const f = await fixture();
  f.rows.head = { ...f.rows.head, revision: f.rows.head.revision + 1 };
  assert.equal((await reader(input(f))).error, "AUDIT_HEAD_INVALID");
});

test("denies Production before issuing any D1 query", async () => {
  const f = await fixture();
  assert.equal((await reader(input(f, { environment: "production" }))).error, "INPUT_INVALID");
  assert.equal(f.DB.calls.length, 0);
});

test("fails closed if the audit verifier rejects the chain", async () => {
  const f = await fixture();
  assert.equal((await reader(input(f, { auditApi: { verifyLedger: async () => ({ ok: false }) } }))).error, "AUDIT_VERIFY_FAILED");
});

test("requires each persisted task event to have a matching audit event", async () => {
  const f = await fixture();
  const unrelated = await fixture({ taskId: "reader-task-02" });
  f.rows.auditRows = unrelated.rows.auditRows;
  f.rows.head = unrelated.rows.head;
  assert.equal((await reader(input(f))).error, "TASK_AUDIT_LINK_MISSING");
});

test("rejects omitted tenant scope before any D1 read", async () => {\n  const f = await fixture();\n  const { tenantId, ...missingScope } = input(f);\n  assert.equal((await reader(missingScope)).error, "INPUT_INVALID");\n  assert.equal(f.DB.calls.length, 0);\n});\n\ntest("supports explicitly scoped global tasks without permitting Production", async () => {
  const f = await fixture({ tenantId: null, taskId: "global-reader-task-01" });
  const result = await reader(input(f));
  assert.equal(result.ok, true);
  assert.equal(result.task.tenantId, null);
  assert.equal(result.ledger.tenantId, null);
});
