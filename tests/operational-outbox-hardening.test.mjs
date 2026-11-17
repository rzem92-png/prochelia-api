import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, "missing source section: " + startMarker);
  return source.slice(start, end);
}

test("outbox processing invokes the executor instead of marking pending work completed by default", () => {
  const handler = section("async function processActionOutbox(request, env)", "async function executeOperationalCase");
  assert.match(handler, /executeQueuedAction\(env,row\)/);
  assert.match(handler, /WAITING_PROVIDER/);
  assert.doesNotMatch(handler, /SET status='COMPLETED'.*WHERE id=/s);
});

test("operational execution never trusts an action list supplied by the browser", () => {
  const handler = section("async function operationalExecute(request, env)", "async function scoreClients");
  assert.match(handler, /JSON\.parse\(c\.proposed_solution_json/);
  assert.match(handler, /Array\.isArray\(solution\.actions\)/);
  assert.doesNotMatch(handler, /Array\.isArray\(b\.actions\)/);
  assert.match(handler, /ACTION_REQUIRES_GOVERNED_APPROVAL/);
});

test("direct operational execution is limited to server-stored in-app notifications", () => {
  const handler = section("async function operationalExecute(request, env)", "async function scoreClients");
  assert.match(handler, /toUpperCase\(\)!=='NOTIFY'/);
  assert.match(handler, /channel:'IN_APP'/);
  assert.match(handler, /executeQueuedAction\(env,q\)/);
  assert.match(handler, /CASE_ALREADY_CLOSED/);
});

test("provider-dependent financial actions cannot be reported as executed without a PSP", () => {
  const handler = section("async function executeQueuedAction(env,", "async function operationalExecute");
  assert.match(handler, /action\.action_type === 'REFUND'/);
  assert.match(handler, /action\.action_type === 'PAYOUT'/);
  assert.match(handler, /PSP_EXECUTION_REQUIRED/);
  assert.match(handler, /WAITING_PROVIDER/);
});

test("case approval queues mission changes instead of mutating missions directly", () => {
  const handler = section("async function executeCaseBusinessAction", "async function processActionOutbox");
  assert.match(handler, /enqueueAction\(env,c\.id,'ASSIGN_REPLACEMENT'/);
  assert.match(handler, /enqueueAction\(env,c\.id,'RESCHEDULE_MISSION'/);
  assert.doesNotMatch(handler, /UPDATE missions SET/);
});

test("operational case approval remains IN_PROGRESS until a downstream action is confirmed", () => {
  const handler = section("async function executeOperationalCase", "async function approveOperationalCase");
  assert.match(handler, /executed:false/);
  assert.match(handler, /status:'IN_PROGRESS'/);
  assert.match(handler, /execution_claim:'QUEUED_NOT_CONFIRMED'/);
  assert.match(handler, /status='IN_PROGRESS'/);
  assert.match(handler, /VALUES\(\?\,\?\,\?\,\?\,\?\,\?\,\?\,NULL\)/);
  assert.doesNotMatch(handler, /status='RESOLVED'/);
  assert.doesNotMatch(handler, /'COMPLETED'/);
});

test("outbox executor atomically claims a pending row before any side effect", () => {
  const executor = section("async function executeQueuedAction(env,", "async function operationalExecute(request, env)");
  const claim = executor.indexOf("SET status='PROCESSING'");
  const sideEffect = executor.indexOf("if (action.action_type === 'NOTIFY')");
  assert.ok(claim >= 0 && sideEffect > claim, "claim must precede notification/accounting/mission side effects");
  assert.match(executor, /WHERE id=\? AND status='PENDING'/);
  assert.match(executor, /claim\?\.meta\?\.changes/);
  assert.match(executor, /ACTION_ALREADY_CLAIMED/);
  assert.match(executor, /WHERE id=\? AND status='PROCESSING'/);
  assert.doesNotMatch(executor, /attempts=attempts\+1.*attempts=attempts\+1/s);
});

test("stale PROCESSING actions are quarantined for reconciliation and never auto-replayed", () => {
  const handler = section("async function processActionOutbox(request, env)", "async function executeOperationalCase");
  assert.match(handler, /SET status='RECONCILIATION_REQUIRED'/);
  assert.match(handler, /updated_at < datetime\('now','-15 minutes'\)/);
  assert.match(handler, /inspect downstream effects before any manual retry/);
  assert.match(handler, /reconciliation_required:reconciliationRequired/);
  assert.match(handler, /WHERE status='PENDING'/);
  assert.doesNotMatch(handler, /SET status='PENDING'.*RECONCILIATION_REQUIRED/s);
});
