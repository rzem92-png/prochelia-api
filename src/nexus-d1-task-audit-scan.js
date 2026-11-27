/* Bounded, read-only Nexus task/audit integrity scan for scheduled Preview/dev/test monitoring.
 * Requires an explicit tenant scope and delegates pair verification to the D1 reader.
 * It emits aggregate/minimal findings only: no objectives, payloads, secrets, or execution.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusD1TaskAuditScan = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const ENVS = new Set(["preview", "development", "test"]);
  const STATES = ["RECEIVED", "PLANNED", "AUTHORIZED", "QUEUED", "RUNNING", "VERIFYING", "RETRY_WAIT", "COMPLETED", "FAILED", "ESCALATED", "CANCELLED"];
  const MAX_SCAN = 50;
  function fail(error, extra = {}) { return { ok: false, error, ...extra, executionAllowed: false }; }
  function plain(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.getOwnPropertySymbols(value).length === 0 &&
      Object.keys(descriptors).every(key => descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
  }
  function scopeKey(tenantId) { return tenantId ?? "__GLOBAL__"; }
  async function scanTenantTaskAudit(input = {}) {
    if (!plain(input) || !input.DB || typeof input.DB.prepare !== "function" ||
        !Object.hasOwn(input, "tenantId") || input.tenantId === undefined || (input.tenantId !== null && !ID.test(input.tenantId)) ||
        !ENVS.has(input.environment) || (input.cursor !== undefined && input.cursor !== null && !ID.test(input.cursor)) ||
        (input.limit !== undefined && (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > MAX_SCAN)))
      return fail("INPUT_INVALID");
    const tenantId = input.tenantId ?? null;
    const environment = input.environment;
    const scope = scopeKey(tenantId);
    const limit = input.limit ?? 20;
    const cursor = input.cursor ?? "";
    const readerApi = input.readerApi ?? globalThis.ProcheliaNexusD1TaskAuditReader;
    if (!readerApi || typeof readerApi.loadTaskAuditPair !== "function") return fail("READER_API_UNAVAILABLE");
    let page;
    try {
      page = await input.DB.prepare("SELECT task_id, tenant_id, scope_key, environment, revision, state FROM nexus_task_snapshots WHERE tenant_id IS ? AND scope_key = ? AND environment = ? AND task_id > ? ORDER BY task_id ASC LIMIT ?")
        .bind(tenantId, scope, environment, cursor, limit + 1).all();
    } catch { return fail("D1_SCAN_FAILED"); }
    if (!Array.isArray(page?.results)) return fail("D1_SCAN_RESULT_INVALID");
    const hasMore = page.results.length > limit;
    const rows = page.results.slice(0, limit);
    const findings = [];
    const byState = Object.fromEntries(STATES.map(state => [state, 0]));
    let verified = 0, failed = 0, nextCursor = cursor || null, cursorBlocked = false;
    for (const row of rows) {
      const taskId = row?.task_id;
      if (typeof taskId === "string" && ID.test(taskId)) nextCursor = taskId;
      else cursorBlocked = true;
      if (!plain(row) || !ID.test(taskId || "") || row.tenant_id !== tenantId || row.scope_key !== scope || row.environment !== environment) {
        failed++;
        findings.push({ taskId: typeof taskId === "string" ? taskId.slice(0, 128) : null, code: "SNAPSHOT_SCOPE_OR_ID_INVALID" });
        continue;
      }
      let result;
      try {
        result = await readerApi.loadTaskAuditPair({ DB: input.DB, taskId, tenantId, environment, auditApi: input.auditApi });
      } catch { result = null; }
      if (!plain(result) || result.ok !== true || result.verified !== true || result.executionAllowed !== false ||
          !plain(result.task) || result.task.taskId !== taskId || result.task.tenantId !== tenantId || result.task.environment !== environment ||
          result.task.state !== row.state || Number(result.task.revision) !== Number(row.revision)) {
        failed++;
        findings.push({ taskId, code: plain(result) && typeof result.error === "string" ? result.error : "PAIR_VERIFICATION_FAILED" });
        continue;
      }
      verified++;
      if (Object.hasOwn(byState, result.task.state)) byState[result.task.state]++;
    }
    const truncated = hasMore || cursorBlocked;
    return {
      ok: true,
      healthy: failed === 0 && !truncated,
      environment,
      tenantId,
      scopeKey: scope,
      scanned: rows.length,
      verified,
      failed,
      byState,
      findings,
      truncated,
      cursorBlocked,
      nextCursor: hasMore && !cursorBlocked ? nextCursor : null,
      executionAllowed: false,
      mode: "READ_ONLY_INTEGRITY_SCAN",
    };
  }
  return Object.freeze({ scanTenantTaskAudit });
});
