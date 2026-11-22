import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUPRA_ACTION_POLICIES, evaluateSupraActionPolicy } from "../src/supra-action-policy.mjs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const supraApi = readFileSync(new URL("../src/supra-api.js", import.meta.url), "utf8");
const executorStart = source.indexOf("async function executeQueuedAction(");
const executorEnd = source.indexOf("\nasync function operationalExecute(", executorStart);
assert.ok(executorStart >= 0 && executorEnd > executorStart, "canonical queued action executor must exist");
const executor = source.slice(executorStart, executorEnd);

test("notification enqueue is never reported as delivered or completed", () => {
  const notifyStart = executor.indexOf("if (action.action_type === 'NOTIFY')");
  const rescheduleStart = executor.indexOf("} else if (action.action_type === 'RESCHEDULE_MISSION')", notifyStart);
  assert.ok(notifyStart >= 0 && rescheduleStart > notifyStart);
  const notify = executor.slice(notifyStart, rescheduleStart);
  assert.match(notify, /performed:false,requires_provider:true/);
  assert.match(notify, /DELIVERY_RECEIPT_REQUIRED/);
  assert.doesNotMatch(notify, /performed:true/);
});

test("mission rescheduling cannot mutate by an unscoped entity ID", () => {
  const start = executor.indexOf("} else if (action.action_type === 'RESCHEDULE_MISSION')");
  const end = executor.indexOf("} else if (action.action_type === 'ASSIGN_REPLACEMENT')", start);
  assert.ok(start >= 0 && end > start);
  const branch = executor.slice(start, end);
  assert.match(branch, /TENANT_SCOPED_MISSION_EXECUTOR_REQUIRED/);
  assert.doesNotMatch(branch, /dynamicUpdate\(/);
});

test("replacement assignment requires the verified qualification and availability workflow", () => {
  const start = executor.indexOf("} else if (action.action_type === 'ASSIGN_REPLACEMENT')");
  const end = executor.indexOf("} else if (action.action_type === 'REFUND')", start);
  assert.ok(start >= 0 && end > start);
  const branch = executor.slice(start, end);
  assert.match(branch, /VERIFIED_ASSIGNMENT_WORKFLOW_REQUIRED/);
  assert.doesNotMatch(branch, /dynamicUpdate\(/);
});

test("financial actions remain blocked without the real payment provider and ledger", () => {
  assert.match(executor, /PSP_EXECUTION_REQUIRED/);
  assert.match(executor, /TENANT_SCOPED_DOUBLE_ENTRY_LEDGER_NOT_IMPLEMENTED/);
});

test("action outbox cannot mark an item complete without a verified executor", () => {
  const start = source.indexOf("async function processActionOutbox(");
  const end = source.indexOf("\nasync function executeOperationalCase(", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /WAITING_IMPLEMENTATION/);
  assert.match(handler, /NO_VERIFIED_EXECUTOR_REGISTERED/);
  assert.doesNotMatch(handler, /status='COMPLETED'/);
});

test("operational cases remain open until every business effect is explicitly verified", () => {
  const start = source.indexOf("async function executeOperationalCase(");
  const end = source.indexOf("\nasync function approveOperationalCase(", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /businessResults\.every\(x => x\?\.status === 'VERIFIED'\)/);
  assert.match(handler, /verified \? 'RESOLVED' : 'IN_PROGRESS'/);
});

test("case actions never mutate mission assignment or schedule without the verified workflow", () => {
  const start = source.indexOf("async function executeCaseBusinessAction(");
  const end = source.indexOf("\nasync function processActionOutbox(", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /VERIFIED_ASSIGNMENT_WORKFLOW_REQUIRED/);
  assert.match(handler, /TENANT_SCOPED_MISSION_EXECUTOR_REQUIRED/);
  assert.doesNotMatch(handler, /UPDATE missions SET/);
});

test("manual operational execution cannot resolve a case on DONE alone", () => {
  const start = source.indexOf("async function operationalExecute(");
  const end = source.indexOf("\nasync function scoreClients(", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /x\.status==='VERIFIED'/);
  assert.match(handler, /verification_required:!allVerified/);
  assert.doesNotMatch(handler, /\['DONE'\]\.includes\(x\.status\)/);
});

test("background jobs use conditional claims and recover stale leases with bounded backoff", () => {
  const start = source.indexOf("async function processBackgroundJobs(");
  const end = source.indexOf("\nasync function ", start + 30);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /WHERE id=\? AND status='PENDING'/);
  assert.match(handler, /status='RUNNING'.*locked_at<=datetime\(CURRENT_TIMESTAMP,'-10 minutes'\)/s);
  assert.match(handler, /Math\.min\(3600,30\*Math\.pow\(2,/);
  assert.match(handler, /background_jobs_dead_letter/);
});

test("scheduled automation is explicit and does not expose scheduler privilege to HTTP callers", () => {
  assert.match(source, /scheduler\s*\?\s*\{auth:\{user:\{id:'cloudflare-cron',role:'GERANTE'\}\}\}\s*:\s*await requireAuthRole/);
  assert.match(source, /event\?\.cron === '\*\/1 \* \* \* \*'/);
  assert.match(source, /event\?\.cron === '0 3 \* \* \*' \|\| event\?\.cron === '0 3 \* \* 0'/);
});

test("NEXUS SUPRA action policy denies unknown actions and missing execution controls", () => {
  assert.equal(evaluateSupraActionPolicy({ actionType: "UNKNOWN" }).allowed, false);
  const invalidAutonomy = evaluateSupraActionPolicy({ actionType: "NOTIFY", role: "GERANTE", jurisdiction: "FR", autonomyLevel: "toString", tenantScoped: true, idempotencyKey: "x" });
  assert.equal(invalidAutonomy.allowed, false);
  assert.ok(invalidAutonomy.reasons.includes("AUTONOMY_LEVEL_INSUFFICIENT"));
  const missing = evaluateSupraActionPolicy({
    actionType: "NOTIFY", role: "GERANTE", jurisdiction: "FR", autonomyLevel: "A3"
  });
  assert.equal(missing.allowed, false);
  assert.ok(missing.reasons.includes("TENANT_SCOPE_REQUIRED"));
  assert.ok(missing.reasons.includes("IDEMPOTENCY_KEY_REQUIRED"));
});

test("NEXUS SUPRA only permits notification enqueue with tenant scope and idempotency", () => {
  const result = evaluateSupraActionPolicy({
    actionType: "NOTIFY", role: "GERANTE", jurisdiction: "FR",
    autonomyLevel: "A3", tenantScoped: true, idempotencyKey: "notify-123"
  });
  assert.equal(result.allowed, true);
  assert.equal(result.executor, "ENQUEUE_ONLY");
  assert.equal(result.verification, "PROVIDER_DELIVERY_RECEIPT");
});

test("financial actions require human approval and remain blocked without verified executors", () => {
  for (const actionType of ["REFUND", "PAYOUT", "ACCOUNTING_ENTRY"]) {
    const result = evaluateSupraActionPolicy({
      actionType, role: "GERANTE", jurisdiction: "FR", autonomyLevel: "A4",
      tenantScoped: true, idempotencyKey: "finance-123", hasApproval: true
    });
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes("VERIFIED_EXECUTOR_NOT_IMPLEMENTED"));
    assert.equal(result.approvalRequired, true);
  }
});

test("production releases, production migrations, sanctions and deletion are never autonomous", () => {
  for (const actionType of ["PRODUCTION_RELEASE", "PRODUCTION_MIGRATION", "ACCOUNT_SANCTION", "ACCOUNT_DELETE"]) {
    const result = evaluateSupraActionPolicy({
      actionType, role: "GERANTE", jurisdiction: "GLOBAL", autonomyLevel: "A5",
      tenantScoped: true, idempotencyKey: "protected-123", hasApproval: true
    });
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes("ACTION_PROHIBITED_FROM_AUTONOMOUS_EXECUTION"));
  }
});

test("all registered policies declare risk, executor, verification, tenant and idempotency contracts", () => {
  for (const [name, policy] of Object.entries(SUPRA_ACTION_POLICIES)) {
    assert.ok(policy.risk, name);
    assert.ok(policy.executor, name);
    assert.ok(policy.verification, name);
    assert.equal(policy.tenantScopeRequired, true, name);
    assert.equal(policy.idempotencyRequired, true, name);
  }
});

test("action policy catalogue is read-only and remains behind the NEXUS direction authorization gate", () => {
  assert.match(supraApi, /import \{ SUPRA_ACTION_POLICIES \} from "\.\/supra-action-policy\.mjs"/);
  assert.match(supraApi, /"\/api\/supra\/action-policies"/);
  const start = supraApi.indexOf('if (url.pathname === "/api/supra/action-policies")');
  const end = supraApi.indexOf('if (url.pathname === "/api/supra/domains")', start);
  assert.ok(start >= 0 && end > start);
  const route = supraApi.slice(start, end);
  assert.match(route, /request\.method !== "GET"/);
  assert.match(route, /executionAllowed: false/);
  assert.match(route, /Object\.entries\(SUPRA_ACTION_POLICIES\)/);
  assert.doesNotMatch(route, /\.prepare\(|\.run\(|fetch\(/);
  const authGate = supraApi.slice(0, start);
  assert.match(authGate, /UNAUTHENTICATED/);
  assert.match(authGate, /FORBIDDEN/);
});

test("queued action execution is gated by the deny-by-default NEXUS policy", () => {
  assert.match(source, /import \{ evaluateSupraActionPolicy \} from "\.\/supra-action-policy\.mjs"/);
  const start = source.indexOf("async function executeQueuedAction(");
  const end = source.indexOf("\nasync function operationalExecute(", start);
  assert.ok(start >= 0 && end > start);
  const executor = source.slice(start, end);
  assert.match(executor, /evaluateSupraActionPolicy\(/);
  assert.match(executor, /if \(!policyDecision\.allowed\)/);
  assert.match(executor, /SUPRA_ACTION_POLICY_DENIED/);
  assert.match(executor, /status: "BLOCKED"/);
});

test("operational execution does not trust caller-supplied tenant, jurisdiction, autonomy or approval assertions", () => {
  const start = source.indexOf("async function operationalExecute(");
  const end = source.indexOf("\nasync function scoreClients(", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /jurisdiction: null/);
  assert.match(handler, /autonomyLevel: "A0"/);
  assert.match(handler, /approvedAction: null/);
  assert.match(handler, /tenantScoped: false/);
  assert.doesNotMatch(handler, /b\.tenantScoped|b\.jurisdiction|b\.autonomyLevel|b\.approvedAction/);
});

test("denied operational actions are blocked before any outbox enqueue", () => {
  const start = source.indexOf("async function operationalExecute(");
  const end = source.indexOf("\nasync function scoreClients(", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  const preflightAt = handler.indexOf("const preflight = evaluateSupraActionPolicy(");
  const queueAt = handler.indexOf("const q=await queueAction(");
  assert.ok(preflightAt >= 0 && queueAt > preflightAt);
  assert.match(handler, /queued: false/);
  assert.match(handler, /if \(!preflight\.allowed\)/);
  assert.match(handler, /continue;/);
});


test("background scheduler never bootstraps DDL and waits for the reviewed migration chain", () => {
  const start = source.indexOf("async function processBackgroundJobs(");
  const end = source.indexOf("\nfunction isMutatingMethod", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /BACKGROUND_JOB_SCHEMA_NOT_MIGRATED/);
  assert.match(handler, /background_jobs_dead_letter/);
  assert.match(handler, /activity_journal/);
  assert.doesNotMatch(handler, /ensureFinalHardeningSchema|ensureOperationalSchema/);
  assert.match(handler, /productionConfigCheck\(env,\{persist:false\}\)/);
  assert.doesNotMatch(handler, /productionConfigCheck\(env,\{persist:true\}\)/);
});
