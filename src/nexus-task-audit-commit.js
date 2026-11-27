/* Safe in-memory transition + audit pairing contract.
 * Durable callers must commit both snapshots in one tenant-scoped transaction.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusTaskAuditCommit = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function fail(error, extra = {}) { return { ok: false, error, ...extra }; }
  function plain(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.getOwnPropertySymbols(value).length === 0 &&
      Object.keys(descriptors).every(key => descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
  }
  function validLedgerScope(ledger, task) {
    return plain(ledger) && Number.isSafeInteger(ledger.revision) && ledger.revision >= 0 &&
      typeof ledger.headHash === "string" && /^[a-f0-9]{64}$/i.test(ledger.headHash) &&
      ledger.environment === task.environment && (ledger.tenantId ?? null) === (task.tenantId ?? null);
  }
  async function commitTaskTransitionWithAudit(input = {}) {
    if (!plain(input) || !plain(input.task) || !plain(input.transition) || !plain(input.ledger))
      return fail("INPUT_INVALID");
    const lifecycle = input.lifecycleApi ?? globalThis.ProcheliaNexusTaskLifecycle;
    const bridge = input.bridgeApi ?? globalThis.ProcheliaNexusTaskAuditBridge;
    const audit = input.auditApi ?? globalThis.ProcheliaNexusAuditLedger;
    if (!lifecycle || typeof lifecycle.appendTaskEvent !== "function" ||
        !bridge || typeof bridge.appendTaskAuditEvent !== "function" ||
        !audit || typeof audit.appendAuditEvent !== "function" || typeof audit.verifyLedger !== "function")
      return fail("INTEGRATION_API_UNAVAILABLE");
    if (!validLedgerScope(input.ledger, input.task)) return fail("LEDGER_SCOPE_INVALID");
    let transition;
    try { transition = lifecycle.appendTaskEvent(input.task, input.transition); }
    catch { return fail("TASK_TRANSITION_FAILED", { cause: "THROWN_ERROR" }); }
    if (!plain(transition) || transition.ok !== true || !plain(transition.task))
      return fail("TASK_TRANSITION_REJECTED", { cause: transition?.error ?? "RESULT_INVALID" });
    let event = transition.event;
    if (transition.duplicate === true) {
      event = input.task.history?.find(record => record.eventId === input.transition.eventId);
      if (!plain(event)) return fail("TASK_DUPLICATE_EVENT_MISSING");
    }
    let audited;
    try { audited = await bridge.appendTaskAuditEvent(input.ledger, transition.task, event, audit); }
    catch { return fail("AUDIT_APPEND_FAILED", { cause: "THROWN_ERROR" }); }
    if (!plain(audited) || audited.ok !== true || !plain(audited.ledger) || !plain(audited.auditEvent))
      return fail("AUDIT_APPEND_FAILED", { cause: audited?.cause ?? audited?.error ?? "RESULT_INVALID" });
    const priorRevision = input.ledger.revision;
    const expectedRevision = audited.duplicate === true ? priorRevision : priorRevision + 1;
    if (audited.ledger.revision !== expectedRevision || (audited.duplicate === true ? audited.ledger.headHash !== input.ledger.headHash : audited.ledger.headHash === input.ledger.headHash) ||
        audited.auditEvent.eventId !== event.eventId || audited.auditEvent.taskId !== input.task.taskId ||
        audited.auditEvent.environment !== input.task.environment ||
        (audited.auditEvent.tenantId ?? null) !== (input.task.tenantId ?? null) ||
        audited.auditEvent.executionAllowed !== false)
      return fail("AUDIT_COMMIT_CONTRACT_INVALID");
    let verified;
    try { verified = await audit.verifyLedger(audited.ledger); }
    catch { return fail("AUDIT_VERIFY_FAILED", { cause: "THROWN_ERROR" }); }
    if (!plain(verified) || verified.ok !== true) return fail("AUDIT_VERIFY_FAILED", { cause: verified?.error ?? "RESULT_INVALID" });
    return {
      ok: true,
      task: transition.task,
      ledger: audited.ledger,
      transitionEvent: event,
      auditEvent: audited.auditEvent,
      taskDuplicate: transition.duplicate === true,
      auditDuplicate: audited.duplicate === true,
      commitMode: "PAIR_ATOMIC_REQUIRED",
      executionAllowed: false,
    };
  }
  return Object.freeze({ commitTaskTransitionWithAudit });
});
