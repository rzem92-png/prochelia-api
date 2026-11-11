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

const resolveStart = source.indexOf("async function supportResolve");
const resolveEnd = source.indexOf("\nasync function ", resolveStart + 20);
assert.notEqual(resolveStart, -1, "supportResolve must exist");
assert.notEqual(resolveEnd, -1, "supportResolve must have a following function boundary");
const managerResolver = source.slice(resolveStart, resolveEnd);

test("manager resolution validates input and uses an allowed-state compare-and-set", () => {
  assert.match(managerResolver, /suppliedResolution\.length>2000/);
  assert.match(managerResolver, /status IN/);
  assert.match(managerResolver, /OPEN.*WAITING_ACTION.*ESCALATED/);
  assert.match(managerResolver, /update\?\.meta\?\.changes/);
  assert.match(managerResolver, /CASE_STATE_CONFLICT/);
});

const createStart = source.indexOf("async function supportCreate");
const createEnd = source.indexOf("\nasync function supportAutoResolve", createStart + 20);
assert.notEqual(createStart, -1, "supportCreate must exist");
assert.notEqual(createEnd, -1, "supportCreate must have a following function boundary");
const creator = source.slice(createStart, createEnd);

test("support API never claims an automatic resolution while action is pending", () => {
  assert.match(creator, /automatic_resolution:false/);
  assert.match(creator, /manager_approval_required:auto \? true : requiresManager/);
  assert.match(creator, /auto_check:!!auto/);
  assert.doesNotMatch(creator, /automatic_resolution:!!auto|manager_approval_required:!auto/);
});

test("support creation validates payload, severity, category and description size", () => {
  assert.match(creator, /INVALID_SUPPORT_PAYLOAD/);
  assert.match(creator, /INVALID_SUPPORT_CATEGORY/);
  assert.match(creator, /INVALID_SUPPORT_SEVERITY/);
  assert.match(creator, /INVALID_SUPPORT_DESCRIPTION/);
  assert.match(creator, /length>4000/);
  assert.match(creator, /\['LOW','MEDIUM','HIGH','CRITICAL'\]/);
});
