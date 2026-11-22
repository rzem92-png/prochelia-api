import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
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
