import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function promotionList(");
const end = source.indexOf("\nasync function activatePromotion(", start);
const handler = source.slice(start, end);

test("only the manager can request the internal promotion directory", () => {
  assert.match(handler, /if\(role==='gerante'\)/);
  assert.match(handler, /SELECT \* FROM promotions/);
});

test("client and company see only active current offers for their audience", () => {
  assert.match(handler, /const audience=role==='entreprise'\?'B2B':'B2C'/);
  assert.match(handler, /WHERE status='ACTIVE'/);
  assert.match(handler, /datetime\(starts_at\)<=CURRENT_TIMESTAMP AND datetime\(ends_at\)>CURRENT_TIMESTAMP/);
  assert.match(handler, /client_type IN \('ALL',\?\)/);
});

test("public promotion response excludes internal budget, usage, approval and rule fields", () => {
  const publicQuery = handler.slice(handler.indexOf("SELECT code,name,type,client_type"));
  assert.doesNotMatch(publicQuery, /SELECT \*/);
  assert.doesNotMatch(publicQuery, /budget_cents|used_cents|requires_manager|rules_json|created_by|rationale/);
});
