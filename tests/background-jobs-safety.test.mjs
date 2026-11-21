import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function processBackgroundJobs(");
const end = source.indexOf("\nfunction isMutatingMethod", start);
assert.ok(start >= 0 && end > start, "background job processor must exist");
const processor = source.slice(start, end);

test("background jobs require an exclusive conditional claim before execution", () => {
  assert.match(processor, /WHERE id=\? AND status='PENDING'/);
  assert.match(processor, /Number\(claim\?\.meta\?\.changes\|\|0\)!==1\) continue/);
});

test("delegated outbox and briefing work is never falsely marked completed", () => {
  assert.match(processor, /OUTBOX_PROCESSOR_NOT_INTEGRATED/);
  assert.match(processor, /BRIEFING_PROVIDER_NOT_INTEGRATED/);
  assert.match(processor, /performed:false/);
  assert.doesNotMatch(processor, /delegation:'Use \/api\/(?:ops\/outbox\/process|copilot\/briefing)'/);
});

test("only a real processor result can transition a job to DONE", () => {
  assert.match(processor, /const done=result\.performed===true \|\| result\.overall===true/);
  assert.match(processor, /done\?'DONE':'WAITING_PROVIDER'/);
});

test("abandoned RUNNING leases are recovered or exhausted safely", () => {
  assert.match(processor, /status='RUNNING' AND locked_at<=datetime\(CURRENT_TIMESTAMP,'-10 minutes'\)/);
  assert.match(processor, /STALE_LEASE_RECOVERED/);
  assert.match(processor, /recovered_leases:recovered\.length/);
});

test("failed jobs use bounded exponential retry and clear their lease", () => {
  assert.match(processor, /Math\.min\(3600,30\*Math\.pow\(2,Math\.min\(attempts-1,7\)\)\)/);
  assert.match(processor, /run_after=datetime\(CURRENT_TIMESTAMP,\?\),locked_at=NULL,last_error=\?/);
  assert.match(processor, /exhausted\?'FAILED':'PENDING'/);
});
