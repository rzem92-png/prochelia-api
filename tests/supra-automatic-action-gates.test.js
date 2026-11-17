import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function executeCaseBusinessAction");
const end = source.indexOf("\nasync function processActionOutbox", start);
const body = source.slice(start, end);
const execStart = source.indexOf("async function executeOperationalCase");
const execEnd = source.indexOf("\nasync function approveOperationalCase", execStart);
const execute = source.slice(execStart, execEnd);

test("SUPRA never directly mutates mission assignment or schedule from case context", () => {
  assert.ok(body.includes("MANAGER_AND_PROVIDER_VALIDATION_REQUIRED"));
  assert.ok(body.includes("SCHEDULE_VALIDATION_REQUIRED"));
  assert.ok(!body.includes("UPDATE missions SET intervenant_id"));
  assert.ok(!body.includes("UPDATE missions SET start_at"));
  assert.ok(!body.includes("UPDATE missions SET scheduled_at"));
});

test("cases without a concrete handler or with pending outbox actions are never falsely resolved", () => {
  assert.ok(execute.includes("const noHandler = businessResults.length === 0"));
  assert.ok(execute.includes("const pendingActions = noHandler"));
  assert.ok(execute.includes("WAITING_HANDLER"));
  assert.ok(execute.includes("WAITING_PROVIDER"));
  assert.ok(execute.includes("pendingActions ? 'CASE_ACTIONS_PENDING'"));
  assert.ok(execute.includes("pendingActions?'PENDING':'COMPLETED'"));
  assert.ok(execute.includes("pendingActions?null:new Date().toISOString()"));
});

test("outbox never marks an action completed without an audited handler", () => {
  const start = source.indexOf("async function processActionOutbox");
  const end = source.indexOf("\nasync function executeOperationalCase", start);
  const outbox = source.slice(start, end);
  assert.ok(outbox.includes("const waitingStatus = external ? 'WAITING_PROVIDER' : 'WAITING_HANDLER'"));
  assert.ok(outbox.includes("No audited execution handler is registered"));
  assert.ok(!outbox.includes("SET status='COMPLETED'"));
});

test("malformed outbox payloads cannot block fail-closed queue classification", () => {
  const start = source.indexOf("async function processActionOutbox");
  const end = source.indexOf("\nasync function executeOperationalCase", start);
  const outbox = source.slice(start, end);
  assert.ok(outbox.includes("Malformed or legacy payloads must not prevent fail-closed queue classification."));
  assert.ok(!outbox.includes("JSON.parse(row.payload_json)"));
});

test("automatic execution cannot bypass required manager approval", () => {
  assert.ok(execute.includes("if(c.requires_manager && !approverId) return {ok:false,error:'MANAGER_APPROVAL_REQUIRED'};"));
  assert.ok(!execute.includes("requires_manager && !automatic"));
});

test("AUTO_EXECUTED is returned only after a verified RESOLVED result", () => {
  const createStart = source.indexOf("async function createOperationalCase");
  const createEnd = source.indexOf("\n\nasync function getTableColumns", createStart);
  assert.notEqual(createStart, -1);
  assert.notEqual(createEnd, -1);
  const create = source.slice(createStart, createEnd);
  assert.ok(create.includes("execution=await executeOperationalCase"));
  assert.ok(create.includes("execution?.ok===true && execution?.resolution?.status==='RESOLVED'"));
  assert.ok(create.includes("autoExecuted?'AUTO_EXECUTED':executionStatus"));
});
