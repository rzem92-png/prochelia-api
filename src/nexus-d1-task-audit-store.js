/* D1 atomic persistence for Nexus task + verified audit pair.
 * Preview/dev/test only. A single D1.batch() is required; never call writes
 * separately. No route or executor is wired by this module.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusD1TaskAuditStore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const HASH = /^[a-f0-9]{64}$/i;
  const ENVS = new Set(["preview", "development", "test"]);
  const GENESIS = "0".repeat(64);

  function fail(error, extra = {}) { return { ok: false, error, ...extra }; }
  function plain(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.getOwnPropertySymbols(value).length === 0 &&
      Object.keys(descriptors).every(key => descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
  }
  function safeJson(value) {
    try {
      if (!plain(value)) return null;
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Object.keys(descriptors).some(key => !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) return null;
      const json = JSON.stringify(value);
      return typeof json === "string" ? json : null;
    } catch { return null; }
  }
  function validScope(task, ledger) {
    return plain(task) && plain(ledger) && ID.test(task.taskId || "") &&
      ENVS.has(task.environment) && (task.tenantId == null || ID.test(task.tenantId)) &&
      ledger.environment === task.environment && (ledger.tenantId ?? null) === (task.tenantId ?? null);
  }
  function scopeKey(tenantId) { return tenantId ?? "__GLOBAL__"; }

  async function persistTaskAuditPair(input = {}) {
    if (!plain(input) || !input.DB || typeof input.DB.prepare !== "function" ||
        typeof input.DB.batch !== "function" || !plain(input.previousTask) ||
        !plain(input.previousLedger) || !plain(input.commit) || !ID.test(input.commitId || ""))
      return fail("INPUT_INVALID");
    const { previousTask, previousLedger, commit, DB } = input;
    if (!validScope(previousTask, previousLedger) || !plain(commit.task) || !plain(commit.ledger) ||
        !plain(commit.transitionEvent) || !plain(commit.auditEvent) ||
        commit.commitMode !== "PAIR_ATOMIC_REQUIRED" || commit.executionAllowed !== false)
      return fail("PAIR_INVALID");

    const task = commit.task, ledger = commit.ledger, taskEvent = commit.transitionEvent, auditEvent = commit.auditEvent;
    if (!validScope(task, ledger) || task.taskId !== previousTask.taskId ||
        task.environment !== previousTask.environment || (task.tenantId ?? null) !== (previousTask.tenantId ?? null) ||
        task.revision !== previousTask.revision + (commit.taskDuplicate === true ? 0 : 1) ||
        ledger.revision !== previousLedger.revision + (commit.auditDuplicate === true ? 0 : 1) ||
        ledger.revision !== ledger.events?.length || task.history?.length !== task.revision ||
        previousTask.revision !== previousTask.history?.length ||
        previousLedger.revision !== previousLedger.events?.length ||
        !HASH.test(previousLedger.headHash || "") || !HASH.test(ledger.headHash || "") ||
        !ID.test(taskEvent.eventId || "") || taskEvent.taskId !== task.taskId ||
        taskEvent.revision !== task.revision || taskEvent.to !== task.state ||
        (taskEvent.tenantId ?? null) !== (task.tenantId ?? null) || taskEvent.environment !== task.environment ||
        !ID.test(auditEvent.eventId || "") || auditEvent.taskId !== task.taskId ||
        auditEvent.sequence !== ledger.revision || auditEvent.previousHash !== previousLedger.headHash ||
        auditEvent.hash !== ledger.headHash || auditEvent.environment !== task.environment ||
        (auditEvent.tenantId ?? null) !== (task.tenantId ?? null) || auditEvent.executionAllowed !== false ||
        ledger.events.at(-1)?.eventId !== auditEvent.eventId ||
        task.history.at(-1)?.eventId !== taskEvent.eventId)
      return fail("PAIR_CONTRACT_INVALID");

    const auditApi = input.auditApi ?? globalThis.ProcheliaNexusAuditLedger;
    if (!auditApi || typeof auditApi.verifyLedger !== "function") return fail("AUDIT_API_UNAVAILABLE");
    let verification;
    try { verification = await auditApi.verifyLedger(ledger); }
    catch { return fail("AUDIT_VERIFY_FAILED"); }
    if (!plain(verification) || verification.ok !== true || verification.revision !== ledger.revision ||
        verification.headHash !== ledger.headHash) return fail("AUDIT_VERIFY_FAILED");

    const taskJson = safeJson(task), taskEventJson = safeJson(taskEvent), ledgerJson = safeJson(ledger);
    const auditEventJson = safeJson(auditEvent), previousTaskJson = safeJson(previousTask);
    if (!taskJson || !taskEventJson || !ledgerJson || !auditEventJson || !previousTaskJson) return fail("SERIALIZATION_INVALID");
    const scope = scopeKey(task.tenantId), env = task.environment;

    if (commit.taskDuplicate === true || commit.auditDuplicate === true) {
      if (commit.taskDuplicate !== true || commit.auditDuplicate !== true ||
          task.revision !== previousTask.revision || ledger.revision !== previousLedger.revision)
        return fail("REPLAY_PAIR_MISMATCH");
      try {
        const taskRow = await DB.prepare("SELECT revision, snapshot_json FROM nexus_task_snapshots WHERE task_id = ? AND scope_key = ? AND environment = ? LIMIT 1").bind(task.taskId, scope, env).first();
        const headRow = await DB.prepare("SELECT revision, head_hash FROM nexus_audit_ledger_heads WHERE scope_key = ? AND environment = ? LIMIT 1").bind(scope, env).first();
        const taskEventRow = await DB.prepare("SELECT event_json FROM nexus_task_events WHERE event_id = ? AND task_id = ? AND scope_key = ? AND environment = ? LIMIT 1").bind(taskEvent.eventId, task.taskId, scope, env).first();
        const auditEventRow = await DB.prepare("SELECT event_json FROM nexus_audit_ledger_events WHERE event_id = ? AND scope_key = ? AND environment = ? LIMIT 1").bind(auditEvent.eventId, scope, env).first();
        if (!taskRow || !headRow || !taskEventRow || !auditEventRow ||
            Number(taskRow.revision) !== task.revision || taskRow.snapshot_json !== taskJson ||
            Number(headRow.revision) !== ledger.revision || headRow.head_hash !== ledger.headHash ||
            taskEventRow.event_json !== taskEventJson || auditEventRow.event_json !== auditEventJson)
          return fail("REPLAY_NOT_PERSISTED_OR_CONFLICT");
        return { ok: true, persisted: true, duplicate: true, taskRevision: task.revision, auditRevision: ledger.revision, headHash: ledger.headHash, executionAllowed: false };
      } catch { return fail("D1_REPLAY_READ_FAILED"); }
    }

    if (task.revision !== previousTask.revision + 1 || ledger.revision !== previousLedger.revision + 1 ||
        auditEvent.sequence !== previousLedger.revision + 1 || auditEvent.previousHash !== previousLedger.headHash ||
        taskEvent.revision !== previousTask.revision + 1 || taskEvent.sequence !== taskEvent.revision ||
        !ID.test(input.commitId) || previousLedger.revision === 0 && previousLedger.headHash !== GENESIS)
      return fail("REVISION_OR_CHAIN_INVALID");

    const previousLedgerHead = previousLedger.headHash;
    const guardSql = `INSERT INTO nexus_task_commit_guards (commit_id, task_id, scope_key, environment, task_revision, audit_revision, ok)
      SELECT ?, ?, ?, ?, ?, ?, CASE WHEN
        ((? = 0 AND NOT EXISTS (SELECT 1 FROM nexus_task_snapshots WHERE task_id = ?)
            AND NOT EXISTS (SELECT 1 FROM nexus_task_events WHERE task_id = ?))
         OR (? > 0 AND EXISTS (SELECT 1 FROM nexus_task_snapshots WHERE task_id = ? AND scope_key = ? AND environment = ? AND revision = ? AND snapshot_json = ?)
            AND (SELECT COUNT(*) FROM nexus_task_events WHERE task_id = ?) = ?))
        AND ((? = 0 AND NOT EXISTS (SELECT 1 FROM nexus_audit_ledger_heads WHERE scope_key = ? AND environment = ?)
            AND NOT EXISTS (SELECT 1 FROM nexus_audit_ledger_events WHERE scope_key = ? AND environment = ?))
         OR (? > 0 AND EXISTS (SELECT 1 FROM nexus_audit_ledger_heads WHERE scope_key = ? AND environment = ? AND revision = ? AND head_hash = ?)
            AND (SELECT COUNT(*) FROM nexus_audit_ledger_events WHERE scope_key = ? AND environment = ?) = ?))
        AND NOT EXISTS (SELECT 1 FROM nexus_task_events WHERE event_id = ?)
        AND NOT EXISTS (SELECT 1 FROM nexus_task_events WHERE task_id = ? AND revision = ?)
        AND NOT EXISTS (SELECT 1 FROM nexus_audit_ledger_events WHERE event_id = ?)
        AND NOT EXISTS (SELECT 1 FROM nexus_audit_ledger_events WHERE scope_key = ? AND environment = ? AND sequence = ?)
      THEN 1 ELSE 0 END`;
    const guardBindings = [
      input.commitId, task.taskId, scope, env, task.revision, ledger.revision,
      previousTask.revision, task.taskId, task.taskId,
      previousTask.revision, task.taskId, scope, env, previousTask.revision, previousTaskJson, task.taskId, previousTask.revision,
      previousLedger.revision, scope, env, scope, env,
      previousLedger.revision, scope, env, previousLedger.revision, previousLedgerHead, scope, env, previousLedger.revision,
      taskEvent.eventId, task.taskId, taskEvent.revision,
      auditEvent.eventId, scope, env, auditEvent.sequence
    ];
    const statements = [
      DB.prepare(guardSql).bind(...guardBindings),
      DB.prepare(`INSERT INTO nexus_task_snapshots (task_id, tenant_id, scope_key, environment, revision, state, snapshot_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET revision=excluded.revision, state=excluded.state, snapshot_json=excluded.snapshot_json, updated_at=CURRENT_TIMESTAMP`)
        .bind(task.taskId, task.tenantId ?? null, scope, env, task.revision, task.state, taskJson),
      DB.prepare(`INSERT INTO nexus_task_events (event_id, task_id, tenant_id, scope_key, environment, revision, event_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(taskEvent.eventId, task.taskId, task.tenantId ?? null, scope, env, taskEvent.revision, taskEventJson),
      DB.prepare(`INSERT INTO nexus_audit_ledger_events (event_id, scope_key, tenant_id, environment, sequence, previous_hash, hash, event_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(auditEvent.eventId, scope, task.tenantId ?? null, env, auditEvent.sequence, auditEvent.previousHash, auditEvent.hash, auditEventJson),
      DB.prepare(`INSERT INTO nexus_audit_ledger_heads (scope_key, tenant_id, environment, revision, head_hash)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(scope_key, environment) DO UPDATE SET revision=excluded.revision, head_hash=excluded.head_hash, updated_at=CURRENT_TIMESTAMP`)
        .bind(scope, task.tenantId ?? null, env, ledger.revision, ledger.headHash),
      DB.prepare("DELETE FROM nexus_task_commit_guards WHERE commit_id = ?").bind(input.commitId)
    ];
    let results;
    try { results = await DB.batch(statements); }
    catch { return fail("D1_ATOMIC_BATCH_FAILED"); }
    if (!Array.isArray(results) || results.length !== statements.length ||
        results.some(result => result?.success !== true || Number(result?.meta?.changes) !== 1))
      return fail("D1_COMMIT_RESULT_UNKNOWN");
    return { ok: true, persisted: true, duplicate: false, taskRevision: task.revision, auditRevision: ledger.revision, headHash: ledger.headHash, executionAllowed: false };
  }

  return Object.freeze({ persistTaskAuditPair });
});
