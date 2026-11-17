import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

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

test("idempotency insert races re-read and return the winning outbox row", () => {
  const handler = section("async function queueAction", "async function executeQueuedAction");
  assert.match(source, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(handler, /catch\s*\(error\)/);
  assert.match(handler, /SELECT \* FROM action_outbox WHERE idempotency_key=\? LIMIT 1/);
  assert.match(handler, /if \(raced\) return raced/);
});

test("executor reports reconciliation instead of false success when its claim was lost", () => {
  const executor = section("async function executeQueuedAction(env,", "async function operationalExecute(request, env)");
  assert.match(executor, /const finalized = await env\.DB\.prepare/);
  assert.match(executor, /finalized\?\.meta\?\.changes/);
  assert.match(executor, /ACTION_FINALIZATION_NOT_OWNED/);
  assert.match(executor, /const failed = await env\.DB\.prepare/);
  assert.match(executor, /failed\?\.meta\?\.changes/);
  assert.match(executor, /ACTION_FAILURE_NOT_OWNED/);
  assert.match(executor, /status:'RECONCILIATION_REQUIRED'/);
});

test("outbox leases are persisted, expiring, and required to finalize a claimed action", () => {
  const schema = section("async function ensureOperationalSchema", "async function tableExists");
  const executor = section("async function executeQueuedAction(env,", "async function operationalExecute(request, env)");
  const handler = section("async function processActionOutbox(request, env)", "async function executeOperationalCase");
  assert.match(schema, /lease_token TEXT/);
  assert.match(schema, /lease_expires_at TEXT/);
  assert.match(schema, /ensureActionColumn/);
  assert.match(schema, /\[\x27case_id\x27,\x27processed_at\x27,\x27lease_token\x27,\x27lease_expires_at\x27\]/);
  assert.match(schema, /Another request may have completed the same additive schema change/);
  assert.match(executor, /lease_expires_at=datetime\('now','\+15 minutes'\)/);
  assert.match(executor, /WHERE id=\? AND status='PROCESSING' AND lease_token=\?/);
  assert.match(executor, /WHERE EXISTS \(SELECT 1 FROM action_outbox WHERE id=\? AND status='PROCESSING' AND lease_token=\?\)/);
  assert.match(handler, /lease_token=NULL, lease_expires_at=NULL/);
  assert.match(handler, /lease_expires_at < CURRENT_TIMESTAMP/);
});

test("SQLite lease simulation prevents stale workers from writing or finalizing", () => {
  const python = String.raw`
import sqlite3
db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE action_outbox (
  id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT, lease_expires_at TEXT, result_json TEXT
);
CREATE TABLE notification_outbox (id TEXT PRIMARY KEY, message TEXT NOT NULL);
INSERT INTO action_outbox(id,idempotency_key) VALUES('a1','idem-1');
""")
claim = db.execute("""
UPDATE action_outbox SET status='PROCESSING', lease_token=?,
 lease_expires_at=datetime('now','+15 minutes'), attempts=attempts+1
WHERE id=? AND status='PENDING'
""", ('lease-A','a1'))
assert claim.rowcount == 1
racing_claim = db.execute("""
UPDATE action_outbox SET status='PROCESSING', lease_token=?
WHERE id=? AND status='PENDING'
""", ('lease-B','a1'))
assert racing_claim.rowcount == 0
db.execute("UPDATE action_outbox SET lease_expires_at=datetime('now','-1 minute') WHERE id='a1'")
db.execute("""
UPDATE action_outbox SET status='RECONCILIATION_REQUIRED',
 lease_token=NULL, lease_expires_at=NULL
WHERE status='PROCESSING' AND lease_expires_at < CURRENT_TIMESTAMP
""")
stale_write = db.execute("""
INSERT INTO notification_outbox(id,message)
SELECT ?,? WHERE EXISTS (
 SELECT 1 FROM action_outbox WHERE id=? AND status='PROCESSING' AND lease_token=?
)
""", ('n1','must not be written','a1','lease-A'))
assert stale_write.rowcount == 0
stale_finalize = db.execute("""
UPDATE action_outbox SET status='DONE', result_json='{}'
WHERE id=? AND status='PROCESSING' AND lease_token=?
""", ('a1','lease-A'))
assert stale_finalize.rowcount == 0
row = db.execute("SELECT status,lease_token FROM action_outbox WHERE id='a1'").fetchone()
assert row == ('RECONCILIATION_REQUIRED', None), row
try:
    db.execute("INSERT INTO action_outbox(id,idempotency_key) VALUES('a2','idem-1')")
    raise AssertionError("duplicate idempotency key unexpectedly inserted")
except sqlite3.IntegrityError:
    existing = db.execute("SELECT id FROM action_outbox WHERE idempotency_key='idem-1'").fetchone()
    assert existing == ('a1',), existing
`;
  const result = spawnSync("python3", ["-c", python], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
