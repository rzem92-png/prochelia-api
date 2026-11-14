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
  assert.match(body, /MANAGER_AND_PROVIDER_VALIDATION_REQUIRED/);
  assert.match(body, /SCHEDULE_VALIDATION_REQUIRED/);
  assert.doesNotMatch(body, /UPDATE missions SET (intervenant_id|start_at|scheduled_at)/);
});

test("cases with pending outbox actions remain pending rather than falsely resolved", () => {
  assert.match(execute, /const pendingActions = businessResults\.some\(item => item\.status !== 'COMPLETED'\)/);
  assert.match(execute, /pendingActions \? 'WAITING_PROVIDER' : 'RESOLVED'/);
  assert.match(execute, /pendingActions\?'PENDING':'COMPLETED'/);
  assert.match(execute, /pendingActions\?null:new Date\(\)\.toISOString\(\)/);
});
