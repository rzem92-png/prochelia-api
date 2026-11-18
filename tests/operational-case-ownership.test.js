import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("non-manager operational cases derive client/intervenant ownership from session user", () => {
  const start = source.indexOf("async function resolveOperationalCaseScope");
  const end = source.indexOf("\nasync function createOperationalCase", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(body, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(body, /missions WHERE id=\? AND client_id=\?/);
  assert.match(body, /missions WHERE id=\? AND intervenant_id=\?/);
  assert.match(body, /COMPANY_OWNERSHIP_NOT_VERIFIED/);
});

test("non-manager Copilot submissions are proposals and cannot execute automatically", () => {
  const start = source.indexOf("async function createOperationalCase");
  const end = source.indexOf("\n\nasync function getTableColumns", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /if\(!manager\) rec=\{\.\.\.rec,action:'PROPOSE',mode:'MANAGER_APPROVAL'\}/);
  assert.match(body, /const safeContext=manager/);
  assert.doesNotMatch(body, /executeOperationalCase\(env,id,null,true\)/);
});

test("complaint creation verifies ownership before inserting complaint records", () => {
  const start = source.indexOf("async function complaintCreate");
  const end = source.indexOf("\n\nasync function setPhase", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.ok(body.indexOf("resolveOperationalCaseScope") < body.indexOf("INSERT INTO complaints"));
});

test("persisted pricing quotes are manager-only until server-owned policy is authoritative", () => {
  const start = source.indexOf("async function pricingQuote");
  const end = source.indexOf("\nasync function financeSummary", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.ok(body.includes("requireAuthRole(request,env,['gerante'])"));
});
