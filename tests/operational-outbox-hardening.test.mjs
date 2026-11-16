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
