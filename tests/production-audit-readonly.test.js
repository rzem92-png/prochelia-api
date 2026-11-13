import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("productionConfigCheck is non-mutating unless persist=true is explicitly requested", () => {
  const start = source.indexOf("async function productionConfigCheck");
  const end = source.indexOf("\nasync function finalProductionAudit", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /persist = false/);
  assert.match(body, /if \(persist\) \{/);
  assert.match(body, /if \(persist\) for\(const c of checks\)/);
  assert.match(body, /if \(persist\) \{/);
});

test("GET production audit handlers do not journal or insert check records", () => {
  const start = source.indexOf("async function finalProductionAudit");
  const end = source.indexOf("\nasync function copilotNextActions", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /await journal\(/);
  assert.doesNotMatch(body, /INSERT INTO system_config_checks/);
  assert.match(body, /GET audit endpoint is intentionally read-only/);

  const strictStart = source.indexOf("async function strictProductionAudit");
  const strictEnd = source.indexOf("\nasync function ", strictStart + 1);
  assert.notEqual(strictStart, -1);
  assert.notEqual(strictEnd, -1);
  const strictBody = source.slice(strictStart, strictEnd);
  assert.doesNotMatch(strictBody, /await journal\(/);
  assert.doesNotMatch(strictBody, /INSERT INTO system_config_checks/);
});
