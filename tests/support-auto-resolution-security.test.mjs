import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function supportAutoResolve");
const end = source.indexOf("\nasync function ", start + 20);
assert.notEqual(start, -1, "supportAutoResolve must exist");
assert.notEqual(end, -1, "supportAutoResolve must have a following function boundary");
const resolver = source.slice(start, end);

test("support resolution never trusts client-supplied execution_verified", () => {
  assert.doesNotMatch(resolver, /execution_verified|context\?/);
  assert.doesNotMatch(resolver, /context\s*=/);
});

test("support resolution remains fail-closed until server-owned downstream proof exists", () => {
  assert.match(resolver, /status='WAITING_ACTION'/);
  assert.match(resolver, /requires_manager=1/);
  assert.match(resolver, /verified:false/);
  assert.match(resolver, /source:'SERVER_SIDE_DOWNSTREAM'/);
  assert.doesNotMatch(resolver, /status='RESOLVED'|AUTO_RESOLVED_VERIFIED|closed:true/);
});

test("support resolution uses a compare-and-set state transition", () => {
  assert.match(resolver, /WHERE id=\? AND status='PROCESSING'/);
  assert.match(resolver, /update\?\.meta\?\.changes/);
  assert.match(resolver, /STATE_CONFLICT/);
});

test("supportCreate does not pass the raw request body to the resolver", () => {
  assert.match(source, /supportAutoResolve\(env,id,a\.auth\.user\.id,a\.role,scenario\)/);
  assert.doesNotMatch(source, /supportAutoResolve\(env,id,a\.auth\.user\.id,a\.role,scenario,b\)/);
});
