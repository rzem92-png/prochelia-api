import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-d1-task-audit-scan.js";
const scan = globalThis.ProcheliaNexusD1TaskAuditScan.scanTenantTaskAudit;
function makeDB(rows) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            async all() {
              calls.push({ sql, bindings });
              if (sql.includes("nexus_task_snapshots")) return { results: rows };
              return { results: [] };
            }
          };
        }
      };
    }
  };
}
const reader = { async loadTaskAuditPair({ taskId, tenantId, environment }) { return { ok: true, verified: true, executionAllowed: false, task: { taskId, tenantId, environment, state: "COMPLETED", revision: 3 } }; } };
const row = (taskId, tenantId = "tenant-a", environment = "preview", state = "COMPLETED", revision = 3) => ({ task_id: taskId, tenant_id: tenantId, scope_key: tenantId ?? "__GLOBAL__", environment, state, revision });
function input(DB, overrides = {}) { return { DB, tenantId: "tenant-a", environment: "preview", readerApi: reader, ...overrides }; }

test("bounded scan verifies rows and returns keyset cursor when more rows exist", async () => {
  const DB = makeDB([row("task-01"), row("task-02"), row("task-03")]);
  const result = await scan(input(DB, { limit: 2 }));
  assert.equal(result.ok, true); assert.equal(result.healthy, false); assert.equal(result.scanned, 2);
  assert.equal(result.verified, 2); assert.equal(result.failed, 0); assert.equal(result.truncated, true);
  assert.equal(result.nextCursor, "task-02"); assert.equal(result.executionAllowed, false);
  assert.equal(result.byState.COMPLETED, 2); assert.equal(DB.calls[0].bindings[0], "tenant-a");
});

test("cursor is bound into the keyset query and empty page is healthy", async () => {
  const DB = makeDB([]); const result = await scan(input(DB, { cursor: "task-previous", limit: 10 }));
  assert.equal(result.healthy, true); assert.equal(result.scanned, 0); assert.equal(result.nextCursor, null);
  assert.equal(DB.calls[0].bindings[3], "task-previous");
});

test("explicit global scope is supported without tenant leakage", async () => {
  const DB = makeDB([row("global-task", null)]);
  const result = await scan(input(DB, { tenantId: null }));
  assert.equal(result.ok, true); assert.equal(result.scopeKey, "__GLOBAL__");
  assert.equal(DB.calls[0].bindings[0], null); assert.equal(DB.calls[0].bindings[1], "__GLOBAL__");
});

test("requires explicit tenant scope and rejects Production/invalid limits before querying", async () => {
  const DB = makeDB([]); const { tenantId, ...omitted } = input(DB);
  assert.equal((await scan(omitted)).error, "INPUT_INVALID");
  assert.equal((await scan(input(DB, { environment: "production" }))).error, "INPUT_INVALID");
  assert.equal((await scan(input(DB, { limit: 51 }))).error, "INPUT_INVALID");
  assert.equal((await scan(input(DB, { cursor: "bad cursor" }))).error, "INPUT_INVALID");
  assert.equal(DB.calls.length, 0);
});

test("row scope mismatch is a finding and is never passed to the reader", async () => {
  const DB = makeDB([row("task-cross", "tenant-b")]); let called = false;
  const result = await scan(input(DB, { readerApi: { loadTaskAuditPair: async () => { called = true; return { ok: true }; } } }));
  assert.equal(result.failed, 1); assert.equal(result.findings[0].code, "SNAPSHOT_SCOPE_OR_ID_INVALID"); assert.equal(called, false);
});

test("reader verification failure is recorded without exposing task content", async () => {
  const DB = makeDB([row("task-bad")]);
  const result = await scan(input(DB, { readerApi: { loadTaskAuditPair: async () => ({ ok: false, error: "AUDIT_HEAD_MISMATCH", objective: "must not leak" }) } }));
  assert.equal(result.healthy, false); assert.equal(result.failed, 1); assert.equal(result.findings[0].code, "AUDIT_HEAD_MISMATCH");
  assert.equal(JSON.stringify(result).includes("must not leak"), false);
});

test("D1 scan exception fails closed and does not claim health", async () => {
  const DB = { prepare() { throw new Error("unavailable"); } };
  const result = await scan(input(DB)); assert.equal(result.ok, false); assert.equal(result.error, "D1_SCAN_FAILED"); assert.equal(result.executionAllowed, false);
});

test("query limit is capped by the extra row and row snapshot mismatch is unhealthy", async () => {
  const DB = makeDB([row("task-snapshot-mismatch")]);
  const result = await scan(input(DB, { readerApi: { loadTaskAuditPair: async ({ taskId, tenantId, environment }) => ({ ok: true, verified: true, executionAllowed: false, task: { taskId, tenantId, environment, state: "FAILED", revision: 2 } }) } }));
  assert.equal(DB.calls[0].bindings[4], 21);
  assert.equal(result.failed, 1);
  assert.equal(result.findings[0].code, "PAIR_VERIFICATION_FAILED");
  assert.equal(result.healthy, false);
});

test("invalid task identifier blocks pagination rather than reporting healthy", async () => {
  const DB = makeDB([{ ...row("task-invalid"), task_id: "bad id" }, row("task-next")]);
  const result = await scan(input(DB, { limit: 1 }));
  assert.equal(result.cursorBlocked, true);
  assert.equal(result.truncated, true);
  assert.equal(result.nextCursor, null);
  assert.equal(result.healthy, false);
  assert.equal(result.failed, 1);
});


test("unknown snapshot state is rejected before invoking the pair reader", async () => {
  const DB = makeDB([row("task-state-invalid", "tenant-a", "preview", "PAUSED")]); let called = false;
  const result = await scan(input(DB, { readerApi: { loadTaskAuditPair: async () => { called = true; return { ok: true }; } } }));
  assert.equal(result.healthy, false); assert.equal(result.failed, 1);
  assert.equal(result.findings[0].code, "SNAPSHOT_STATE_INVALID"); assert.equal(called, false);
});

test("invalid revision is rejected without passing malformed snapshot to reader", async () => {
  const DB = makeDB([row("task-revision-invalid", "tenant-a", "preview", "COMPLETED", 0)]); let called = false;
  const result = await scan(input(DB, { readerApi: { loadTaskAuditPair: async () => { called = true; return { ok: true }; } } }));
  assert.equal(result.healthy, false); assert.equal(result.failed, 1);
  assert.equal(result.findings[0].code, "SNAPSHOT_REVISION_INVALID"); assert.equal(called, false);
});

test("untrusted reader error strings are normalized to safe codes", async () => {
  const DB = makeDB([row("task-reader-error")]);
  const secretLike = "arbitrary error contains customer data and tokens";
  const result = await scan(input(DB, { readerApi: { loadTaskAuditPair: async () => ({ ok: false, error: secretLike, payload: secretLike }) } }));
  assert.equal(result.healthy, false); assert.equal(result.findings[0].code, "PAIR_VERIFICATION_FAILED");
  assert.equal(JSON.stringify(result).includes(secretLike), false);
});

test("verified reader cannot introduce an unknown lifecycle state", async () => {
  const DB = makeDB([row("task-result-state")]);
  const result = await scan(input(DB, { readerApi: { loadTaskAuditPair: async ({ taskId, tenantId, environment }) => ({ ok: true, verified: true, executionAllowed: false, task: { taskId, tenantId, environment, state: "UNKNOWN", revision: 3 } }) } }));
  assert.equal(result.healthy, false); assert.equal(result.failed, 1);
  assert.equal(result.findings[0].code, "PAIR_VERIFICATION_FAILED");
});
