// Deterministic deny-by-default policy registry for NEXUS SUPRA.
// This module defines authorization metadata; it does not execute business actions.
export const SUPRA_ACTION_POLICIES = Object.freeze({
  NOTIFY: Object.freeze({
    risk: "LOW", minimumAutonomy: "A3", roles: ["GERANTE", "SYSTEM"],
    jurisdictions: ["FR", "DZ", "GLOBAL"], approvalRequired: false,
    executor: "ENQUEUE_ONLY", verification: "PROVIDER_DELIVERY_RECEIPT",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: true
  }),
  RESCHEDULE_MISSION: Object.freeze({
    risk: "HIGH", minimumAutonomy: "A4", roles: ["GERANTE"],
    jurisdictions: ["FR", "DZ"], approvalRequired: true,
    executor: "NOT_IMPLEMENTED", verification: "TENANT_SCOPED_MISSION_STATE_AND_AUDIT",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  ASSIGN_REPLACEMENT: Object.freeze({
    risk: "HIGH", minimumAutonomy: "A4", roles: ["GERANTE"],
    jurisdictions: ["FR", "DZ"], approvalRequired: true,
    executor: "NOT_IMPLEMENTED", verification: "QUALIFICATION_AVAILABILITY_CONFLICT_AND_TENANT_CHECK",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  REFUND: Object.freeze({
    risk: "CRITICAL", minimumAutonomy: "A4", roles: ["GERANTE"],
    jurisdictions: ["FR", "DZ"], approvalRequired: true,
    executor: "NOT_IMPLEMENTED", verification: "PSP_RECEIPT_AND_LEDGER_RECONCILIATION",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  PAYOUT: Object.freeze({
    risk: "CRITICAL", minimumAutonomy: "A4", roles: ["GERANTE"],
    jurisdictions: ["FR", "DZ"], approvalRequired: true,
    executor: "NOT_IMPLEMENTED", verification: "PSP_RECEIPT_AND_LEDGER_RECONCILIATION",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  ACCOUNTING_ENTRY: Object.freeze({
    risk: "CRITICAL", minimumAutonomy: "A4", roles: ["GERANTE"],
    jurisdictions: ["FR", "DZ"], approvalRequired: true,
    executor: "NOT_IMPLEMENTED", verification: "BALANCED_DOUBLE_ENTRY_AND_POSTING_AUDIT",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  PRODUCTION_RELEASE: Object.freeze({
    risk: "CRITICAL", minimumAutonomy: "A5", roles: [],
    jurisdictions: ["GLOBAL"], approvalRequired: true,
    executor: "PROHIBITED_FROM_AUTONOMOUS_EXECUTION", verification: "EXTERNAL_CHANGE_CONTROL",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  PRODUCTION_MIGRATION: Object.freeze({
    risk: "CRITICAL", minimumAutonomy: "A5", roles: [],
    jurisdictions: ["GLOBAL"], approvalRequired: true,
    executor: "PROHIBITED_FROM_AUTONOMOUS_EXECUTION", verification: "BACKUP_RESTORE_AND_SCHEMA_ATTESTATION",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  ACCOUNT_SANCTION: Object.freeze({
    risk: "CRITICAL", minimumAutonomy: "A5", roles: [],
    jurisdictions: ["FR", "DZ"], approvalRequired: true,
    executor: "PROHIBITED_FROM_AUTONOMOUS_EXECUTION", verification: "HUMAN_REVIEW_AND_APPEAL_AUDIT",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  }),
  ACCOUNT_DELETE: Object.freeze({
    risk: "CRITICAL", minimumAutonomy: "A5", roles: [],
    jurisdictions: ["FR", "DZ"], approvalRequired: true,
    executor: "PROHIBITED_FROM_AUTONOMOUS_EXECUTION", verification: "RETENTION_AND_LEGAL_HOLD_REVIEW",
    tenantScopeRequired: true, idempotencyRequired: true, reversible: false
  })
});

const AUTONOMY_RANK = Object.freeze({ A0: 0, A1: 1, A2: 2, A3: 3, A4: 4, A5: 5 });

export function evaluateSupraActionPolicy(input = {}) {
  const actionType = String(input.actionType || "").trim().toUpperCase();
  const policy = SUPRA_ACTION_POLICIES[actionType];
  const reasons = [];
  if (!policy) return Object.freeze({ allowed: false, actionType, risk: "UNKNOWN", reasons: ["ACTION_NOT_REGISTERED"] });
  const role = String(input.role || "").toUpperCase();
  const jurisdiction = String(input.jurisdiction || "").toUpperCase();
  const autonomy = String(input.autonomyLevel || "A0").toUpperCase();
  if (!policy.roles.includes(role)) reasons.push("ROLE_NOT_AUTHORIZED");
  if (!policy.jurisdictions.includes(jurisdiction)) reasons.push("JURISDICTION_NOT_ALLOWED");
  if (!(autonomy in AUTONOMY_RANK) || AUTONOMY_RANK[autonomy] < AUTONOMY_RANK[policy.minimumAutonomy]) reasons.push("AUTONOMY_LEVEL_INSUFFICIENT");
  if (policy.approvalRequired && input.hasApproval !== true) reasons.push("HUMAN_APPROVAL_REQUIRED");
  if (policy.tenantScopeRequired && input.tenantScoped !== true) reasons.push("TENANT_SCOPE_REQUIRED");
  if (policy.idempotencyRequired && !String(input.idempotencyKey || "").trim()) reasons.push("IDEMPOTENCY_KEY_REQUIRED");
  if (policy.executor === "NOT_IMPLEMENTED") reasons.push("VERIFIED_EXECUTOR_NOT_IMPLEMENTED");
  if (policy.executor === "PROHIBITED_FROM_AUTONOMOUS_EXECUTION") reasons.push("ACTION_PROHIBITED_FROM_AUTONOMOUS_EXECUTION");
  return Object.freeze({
    allowed: reasons.length === 0,
    actionType,
    risk: policy.risk,
    approvalRequired: policy.approvalRequired,
    executor: policy.executor,
    verification: policy.verification,
    tenantScopeRequired: policy.tenantScopeRequired,
    idempotencyRequired: policy.idempotencyRequired,
    reasons
  });
}
