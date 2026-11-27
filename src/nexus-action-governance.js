/**
 * Nexus Supra action-governance preflight (Preview prototype).
 * Pure policy decision: this module does not execute actions or grant permissions.
 * Unknown inputs fail closed.
 */
(function (root) {
  "use strict";
  const ENVIRONMENTS = new Set(["preview", "staging", "production"]);
  const MODES = new Set(["observe", "suggest", "execute"]);
  const CLASSES = new Set(["read", "reversible", "sensitive", "irreversible"]);

  function evaluate(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return deny("INVALID_INPUT");
    const i = input;
    if (!ENVIRONMENTS.has(i.environment)) return deny("UNKNOWN_ENVIRONMENT");
    if (!MODES.has(i.mode)) return deny("UNKNOWN_MODE");
    if (!CLASSES.has(i.actionClass)) return deny("UNKNOWN_ACTION_CLASS");
    if (i.killSwitch === true || i.agentKillSwitch === true) return deny("KILL_SWITCH_ACTIVE");
    if (i.permissionGranted !== true || i.toolPermissionGranted !== true) return deny("PERMISSION_REQUIRED");
    if (typeof i.agentId !== "string" || !i.agentId.trim() || typeof i.toolId !== "string" || !i.toolId.trim()) return deny("IDENTITY_REQUIRED");
    if (typeof i.tenantId !== "string" || !i.tenantId.trim() || typeof i.actionTenantId !== "string" || !i.actionTenantId.trim()) return deny("TENANT_SCOPE_REQUIRED");
    if (i.tenantId !== i.actionTenantId) return deny("TENANT_SCOPE_MISMATCH");
    if (i.mode !== "execute") return {ok:true, decision:i.mode === "observe" ? "OBSERVE_ONLY" : "SUGGEST_ONLY", executionAllowed:false, reason:"NON_EXECUTION_MODE"};
    if (i.environment === "production") return deny("PRODUCTION_EXECUTION_BLOCKED");
    if (i.actionClass === "read") return {ok:true,decision:"ALLOW_READ",executionAllowed:true,reason:"READ_ONLY_ACTION"};
    if (i.actionClass === "reversible") {
      if (i.budgetApproved !== true) return deny("BUDGET_OR_LIMIT_REQUIRED");
      if (typeof i.idempotencyKey !== "string" || !i.idempotencyKey.trim()) return deny("IDEMPOTENCY_REQUIRED");
      return {ok:true,decision:"ALLOW_PREVIEW_REVERSIBLE",executionAllowed:true,reason:"BOUNDED_PREVIEW_ACTION"};
    }
    if (i.actionClass === "sensitive" || i.actionClass === "irreversible") {
      if (i.humanApproval !== true) return deny("HUMAN_APPROVAL_REQUIRED");
      if (i.dualApprovalRequired === true && i.dualApproval !== true) return deny("DUAL_APPROVAL_REQUIRED");
      if (i.budgetApproved !== true) return deny("BUDGET_OR_LIMIT_REQUIRED");
      if (typeof i.idempotencyKey !== "string" || !i.idempotencyKey.trim()) return deny("IDEMPOTENCY_REQUIRED");
      return deny("SENSITIVE_ACTION_NOT_AUTONOMOUS");
    }
    return deny("UNHANDLED_POLICY");
  }
  function deny(reason) { return {ok:false,decision:"DENY",executionAllowed:false,reason}; }
  root.ProcheliaNexusActionGovernance = Object.freeze({evaluate});
})(typeof globalThis !== "undefined" ? globalThis : this);
