/* Read-only reconstruction and verification for persisted Nexus task/audit pairs.
 * Preview/dev/test only. This module is deliberately not an API route or executor.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusD1TaskAuditReader = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const HASH = /^[a-f0-9]{64}$/i;
  const ENVS = new Set(["preview", "development", "test"]);
  const STATES = new Set(["RECEIVED", "PLANNED", "AUTHORIZED", "QUEUED", "RUNNING", "VERIFYING", "RETRY_WAIT", "COMPLETED", "FAILED", "ESCALATED", "CANCELLED"]);
  const GENESIS = "0".repeat(64);
  const MAX_TASK_EVENTS = 100;
  const MAX_AUDIT_EVENTS = 200;
  function fail(error, extra = {}) { return { ok: false, error, ...extra }; }
  function plain(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.getOwnPropertySymbols(value).length === 0 &&
      Object.keys(descriptors).every(key => descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
  }
  function safeValue(value, depth = 0, nodes = { count: 0 }) {
    if (depth > 12 || ++nodes.count > 10000) return false;
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Object.keys(descriptors).filter(k => k !== "length");
      return !Object.getOwnPropertySymbols(value).length && keys.length === value.length &&
        keys.every(k => /^(0|[1-9]\d*)$/.test(k) && Number(k) < value.length && descriptors[k].enumerable && Object.hasOwn(descriptors[k], "value")) &&
        value.every(v => safeValue(v, depth + 1, nodes));
    }
    if (!plain(value)) return false;
    const keys = Object.keys(value);
    return keys.length <= 100 && keys.every(k => !["__proto__", "constructor", "prototype"].includes(k) && safeValue(value[k], depth + 1, nodes));
  }
  function parseJson(text) {
    try { const value = JSON.parse(text); return safeValue(value) ? value : null; }
    catch { return null; }
  }
  function stable(value) {
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    if (plain(value)) return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
    return JSON.stringify(value);
  }
  function tenantScope(tenantId) { return tenantId ?? "__GLOBAL__"; }

  async function loadTaskAuditPair(input = {}) {
    if (!plain(input) || !input.DB || typeof input.DB.prepare !== "function" ||
        !ID.test(input.taskId || "") || (input.tenantId !== null && input.tenantId !== undefined && !ID.test(input.tenantId)) ||
        !ENVS.has(input.environment)) return fail("INPUT_INVALID");
    const tenantId = input.tenantId ?? null, environment = input.environment, scope = tenantScope(tenantId);
    const auditApi = input.auditApi ?? globalThis.ProcheliaNexusAuditLedger;
    if (!auditApi || typeof auditApi.verifyLedger !== "function") return fail("AUDIT_API_UNAVAILABLE");
    let snapshotRow, taskRows, headRow, auditRows;
    try {
      snapshotRow = await input.DB.prepare("SELECT task_id, tenant_id, scope_key, environment, revision, state, snapshot_json FROM nexus_task_snapshots WHERE task_id = ? AND tenant_id IS ? AND scope_key = ? AND environment = ? LIMIT 1").bind(input.taskId, tenantId, scope, environment).first();
      if (!snapshotRow) return fail("TASK_NOT_FOUND");
      taskRows = await input.DB.prepare("SELECT event_id, task_id, tenant_id, scope_key, environment, revision, event_json FROM nexus_task_events WHERE task_id = ? AND tenant_id IS ? AND scope_key = ? AND environment = ? ORDER BY revision ASC LIMIT ?").bind(input.taskId, tenantId, scope, environment, MAX_TASK_EVENTS + 1).all();
      headRow = await input.DB.prepare("SELECT scope_key, tenant_id, environment, revision, head_hash FROM nexus_audit_ledger_heads WHERE tenant_id IS ? AND scope_key = ? AND environment = ? LIMIT 1").bind(tenantId, scope, environment).first();
      auditRows = await input.DB.prepare("SELECT event_id, scope_key, tenant_id, environment, sequence, previous_hash, hash, event_json FROM nexus_audit_ledger_events WHERE tenant_id IS ? AND scope_key = ? AND environment = ? ORDER BY sequence ASC LIMIT ?").bind(tenantId, scope, environment, MAX_AUDIT_EVENTS + 1).all();
    } catch { return fail("D1_READ_FAILED"); }
    if (snapshotRow.tenant_id !== tenantId || snapshotRow.scope_key !== scope || snapshotRow.environment !== environment) return fail("TASK_SCOPE_MISMATCH");
    if (!Array.isArray(taskRows?.results) || taskRows.results.length > MAX_TASK_EVENTS) return fail("TASK_EVENT_LIMIT");
    if (!headRow || headRow.tenant_id !== tenantId || headRow.scope_key !== scope || headRow.environment !== environment) return fail("AUDIT_HEAD_NOT_FOUND");
    if (!Array.isArray(auditRows?.results) || auditRows.results.length > MAX_AUDIT_EVENTS) return fail("AUDIT_EVENT_LIMIT");
    const task = parseJson(snapshotRow.snapshot_json);
    if (!plain(task) || task.schemaVersion !== 1 || task.taskId !== input.taskId || task.tenantId !== tenantId || task.environment !== environment ||
        !STATES.has(task.state) || !Number.isSafeInteger(task.revision) || task.revision < 1 || task.revision !== Number(snapshotRow.revision) ||
        snapshotRow.state !== task.state || !Array.isArray(task.history) || task.history.length !== task.revision || task.history.length !== taskRows.results.length) return fail("TASK_SNAPSHOT_INVALID");
    const taskEvents = [];
    for (let index = 0; index < taskRows.results.length; index++) {
      const row = taskRows.results[index], event = parseJson(row.event_json);
      const expectedRevision = index + 1;
      if (!event || row.task_id !== input.taskId || row.tenant_id !== tenantId || row.scope_key !== scope || row.environment !== environment ||
          Number(row.revision) !== expectedRevision || event.eventId !== row.event_id || event.taskId !== input.taskId || event.tenantId !== tenantId ||
          event.environment !== environment || event.revision !== expectedRevision || event.sequence !== expectedRevision ||
          stable(event) !== stable(task.history[index])) return fail("TASK_EVENT_INTEGRITY_FAILED", { index });
      taskEvents.push(event);
    }
    const auditRevision = Number(headRow.revision);
    if (!Number.isSafeInteger(auditRevision) || auditRevision < 1 || auditRevision !== auditRows.results.length || !HASH.test(headRow.head_hash || "")) return fail("AUDIT_HEAD_INVALID");
    const events = [];
    for (let index = 0; index < auditRows.results.length; index++) {
      const row = auditRows.results[index], event = parseJson(row.event_json);
      const expectedSequence = index + 1;
      if (!event || row.scope_key !== scope || row.tenant_id !== tenantId || row.environment !== environment ||
          Number(row.sequence) !== expectedSequence || event.eventId !== row.event_id || event.sequence !== expectedSequence ||
          event.previousHash !== row.previous_hash || event.hash !== row.hash || event.tenantId !== tenantId || event.environment !== environment ||
          event.executionAllowed !== false || !HASH.test(row.hash || "") || !HASH.test(row.previous_hash || "")) return fail("AUDIT_EVENT_INTEGRITY_FAILED", { index });
      events.push(event);
    }
    const ledger = { schemaVersion: 1, environment, tenantId, revision: auditRevision, headHash: headRow.head_hash, events };
    if ((events.at(-1)?.hash ?? GENESIS) !== ledger.headHash) return fail("AUDIT_HEAD_MISMATCH");
    const linked = new Map(events.map(event => [event.eventId, event]));
    for (let index = 0; index < taskEvents.length; index++) {
      const taskEvent = taskEvents[index], auditEvent = linked.get(taskEvent.eventId);
      if (!auditEvent || auditEvent.taskId !== task.taskId || auditEvent.tenantId !== tenantId || auditEvent.environment !== environment || auditEvent.executionAllowed !== false) return fail("TASK_AUDIT_LINK_MISSING", { index });
    }
    let verification;
    try { verification = await auditApi.verifyLedger(ledger); }
    catch { return fail("AUDIT_VERIFY_FAILED"); }
    if (!plain(verification) || verification.ok !== true || verification.revision !== ledger.revision || verification.headHash !== ledger.headHash) return fail("AUDIT_VERIFY_FAILED");
    return { ok: true, task, ledger, verified: true, executionAllowed: false, proof: { taskRevision: task.revision, taskEvents: taskEvents.length, auditRevision: ledger.revision, auditEvents: events.length, headHash: ledger.headHash } };
  }
  return Object.freeze({ loadTaskAuditPair });
});
