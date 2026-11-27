import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-task-lifecycle.js";
import "../src/nexus-audit-ledger.js";
import "../src/nexus-task-audit-bridge.js";
import "../src/nexus-task-audit-commit.js";
import "../src/nexus-d1-task-audit-store.js";

const lifecycle = globalThis.ProcheliaNexusTaskLifecycle;
const ledgerApi = globalThis.ProcheliaNexusAuditLedger;
const bridge = globalThis.ProcheliaNexusTaskAuditBridge;
const commitPair = globalThis.ProcheliaNexusTaskAuditCommit.commitTaskTransitionWithAudit;
const store = globalThis.ProcheliaNexusD1TaskAuditStore.persistTaskAuditPair;

async function fixture() {
  const created = lifecycle.createTask({
    taskId: "d1-task-01", tenantId: "tenant-a", environment: "preview",
    agentId: "ops-agent", taskType: "OPS_REVIEW", riskClass: "OPS",
    idempotencyKey: "idempotency-key-0001", objective: "Preview-only check",
    correlationId: "corr-d1-task-01", maxAttempts: 2, priority: 4
  }, Date.parse("2026-11-27T16:00:00.000Z"));
  assert.equal(created.ok, true);
  const previousTask = created.task;
  const previousLedger = ledgerApi.createLedger({ environment: "preview", tenantId: "tenant-a" }).ledger;
  const transition = {
    eventId: "d1-transition-01", actorId: "planner-01", actorType: "AGENT",
    from: "RECEIVED", to: "PLANNED", expectedRevision: 0,
    occurredAt: "2026-11-27T16:00:01.000Z",
    metadata: { planRef: "plan-01", plannerId: "planner-01", dependencies: [] }
  };
  const pair = await commitPair({ task: previousTask, transition, ledger: previousLedger, lifecycleApi: lifecycle, bridgeApi: bridge, auditApi: ledgerApi });
  assert.equal(pair.ok, true);
  return { previousTask, previousLedger, transition, pair };
}
function mockDb({rows = {}, batchError = null, changes = 1} = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return { sql, bind(...bindings) {
        return { sql, bindings,
          async first() {
            if (sql.includes("FROM nexus_task_snapshots")) return rows.task ?? null;
            if (sql.includes("FROM nexus_audit_ledger_heads")) return rows.head ?? null;
            if (sql.includes("FROM nexus_task_events")) return rows.taskEvent ?? null;
            if (sql.includes("FROM nexus_audit_ledger_events")) return rows.auditEvent ?? null;
            return null;
          }
        };
      }};
    },
    async batch(statements) {
      calls.push(statements);
      if (batchError) throw batchError;
      return statements.map(() => ({ success: true, meta: { changes } }));
    }
  };
}
const json = value => JSON.stringify(value);

test("persists task snapshot, event, ledger head and event in one D1 batch", async () => {
  const { previousTask, previousLedger, pair } = await fixture();
  const DB = mockDb();
  const result = await store({ DB, previousTask, previousLedger, commit: pair, commitId: "commit-d1-01", auditApi: ledgerApi });
  assert.deepEqual(result, { ok: true, persisted: true, duplicate: false, taskRevision: 1, auditRevision: 1, headHash: pair.ledger.headHash, executionAllowed: false });
  assert.equal(DB.calls.length, 1);
  assert.equal(DB.calls[0].length, 6);
  assert.match(DB.calls[0][0].sql, /INSERT INTO nexus_task_commit_guards/);
  assert.match(DB.calls[0][0].sql, /nexus_task_snapshots/);
  assert.match(DB.calls[0][2].sql, /nexus_task_events/);
  assert.match(DB.calls[0][3].sql, /nexus_audit_ledger_events/);
  assert.match(DB.calls[0][4].sql, /nexus_audit_ledger_heads/);
  assert.equal((DB.calls[0][0].sql.match(/\?/g) || []).length, DB.calls[0][0].bindings.length);
  assert.match(DB.calls[0][5].sql, /DELETE FROM nexus_task_commit_guards/);
});

test("rejects cross-tenant scope before preparing any writes", async () => {
  const { previousTask, previousLedger, pair } = await fixture();
  const DB = mockDb();
  const result = await store({ DB, previousTask, previousLedger: { ...previousLedger, tenantId: "tenant-b" }, commit: pair, commitId: "commit-d1-02", auditApi: ledgerApi });
  assert.equal(result.error, "PAIR_INVALID");
  assert.equal(DB.calls.length, 0);
});

test("rechecks the candidate hash chain before persistence", async () => {
  const { previousTask, previousLedger, pair } = await fixture();
  const DB = mockDb();
  const result = await store({ DB, previousTask, previousLedger, commit: pair, commitId: "commit-d1-03", auditApi: { verifyLedger: async () => ({ ok: false }) } });
  assert.equal(result.error, "AUDIT_VERIFY_FAILED");
  assert.equal(DB.calls.length, 0);
});

test("batch exception is fail-closed and returns no candidate snapshots", async () => {
  const { previousTask, previousLedger, pair } = await fixture();
  const DB = mockDb({ batchError: new Error("storage unavailable") });
  const result = await store({ DB, previousTask, previousLedger, commit: pair, commitId: "commit-d1-04", auditApi: ledgerApi });
  assert.equal(result.error, "D1_ATOMIC_BATCH_FAILED");
  assert.equal("task" in result, false);
  assert.equal("ledger" in result, false);
});

test("unexpected D1 change counts are reported unknown, not success", async () => {
  const { previousTask, previousLedger, pair } = await fixture();
  const DB = mockDb({ changes: 0 });
  const result = await store({ DB, previousTask, previousLedger, commit: pair, commitId: "commit-d1-05", auditApi: ledgerApi });
  assert.equal(result.error, "D1_COMMIT_RESULT_UNKNOWN");
});

test("idempotent replay verifies both stored snapshots and events without a batch write", async () => {
  const { previousTask, previousLedger, transition, pair } = await fixture();
  const replay = { ...pair, taskDuplicate: true, auditDuplicate: true };
  const DB = mockDb({ rows: {
    task: { revision: 1, snapshot_json: json(pair.task) },
    head: { revision: 1, head_hash: pair.ledger.headHash },
    taskEvent: { event_json: json(pair.transitionEvent) },
    auditEvent: { event_json: json(pair.auditEvent) }
  }});
  const result = await store({ DB, previousTask: pair.task, previousLedger: pair.ledger, commit: replay, commitId: "commit-d1-06", auditApi: ledgerApi });
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
  assert.equal(DB.calls.length, 0);
});

test("replay mismatch or half-duplicate pair is rejected", async () => {
  const { previousTask, previousLedger, pair } = await fixture();
  const DB = mockDb();
  const half = { ...pair, taskDuplicate: true, auditDuplicate: false };
  const result = await store({ DB, previousTask, previousLedger, commit: half, commitId: "commit-d1-07", auditApi: ledgerApi });
  assert.equal(result.error, "REPLAY_PAIR_MISMATCH");
  assert.equal(DB.calls.length, 0);
});

test("rejects missing commit ID and invalid scope without touching D1", async () => {
  const { previousTask, previousLedger, pair } = await fixture();
  const DB = mockDb();
  assert.equal((await store({ DB, previousTask, previousLedger, commit: pair, auditApi: ledgerApi })).error, "INPUT_INVALID");
  const invalid = { ...pair, task: { ...pair.task, tenantId: "tenant-b" } };
  assert.equal((await store({ DB, previousTask, previousLedger, commit: invalid, commitId: "commit-d1-08", auditApi: ledgerApi })).error, "PAIR_SCOPE_INVALID");
  assert.equal(DB.calls.length, 0);
});
