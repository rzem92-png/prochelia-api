import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing end marker after: ${startMarker}`);
  return source.slice(start, end);
}

test("complaint creation derives a client identity from the authenticated session", () => {
  const body = section("async function complaintCreate(", "async function setPhase(");
  assert.match(body, /requireAuthRole\(request,env,\['gerante','client'\]\)/);
  assert.match(body, /readJsonLimited\(request,8192\)/);
  assert.match(body, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(body, /mission\.client_id!==clientId/);
  assert.match(body, /MISSION_CLIENT_MISMATCH/);
  assert.doesNotMatch(body, /b\.client_type/);
  assert.match(body, /DELETE FROM complaints WHERE id=\?/);
});

test("support creation does not trust requester-supplied relationship identifiers", () => {
  const body = section("async function supportCreate(", "async function supportAutoResolve(");
  assert.match(body, /linkedFields=\['company_id','mission_id','complaint_id'\]/);
  assert.match(body, /LINKED_CASE_REQUIRES_MANAGER_VALIDATION/);
  assert.match(body, /const isManager=\['GERANTE','ADMIN'\]\.includes\(a\.role\)/);
  assert.match(body, /SELECT id FROM missions WHERE id=\?/);
  assert.match(body, /SELECT id FROM complaints WHERE id=\?/);
  assert.match(body, /SELECT id FROM business_profiles WHERE id=\?/);
  assert.doesNotMatch(body, /supportAutoResolve\(env,id,a\.auth\.user\.id,a\.role,scenario,b\)/);
});

test("automatic support resolution fails closed without server-owned evidence", () => {
  const body = section("async function supportAutoResolve(", "async function supportList(");
  assert.doesNotMatch(body, /execution_verified/);
  assert.match(body, /NO_TRUSTED_DOWNSTREAM_ACTION/);
  assert.match(body, /status='WAITING_ACTION'/);
  assert.match(body, /requires_manager=1/);
  assert.match(body, /WHERE id=\? AND status='PROCESSING'/);
  assert.match(body, /CASE_NOT_PROCESSING/);
  assert.doesNotMatch(body, /status='RESOLVED'/);
});

test("manual support resolution is manager-only, bounded and compare-and-set", () => {
  const body = section("async function supportResolve(", "async function supportDashboard(");
  assert.match(body, /a\.role!=='GERANTE'&&a\.role!=='ADMIN'/);
  assert.match(body, /readJsonLimited\(request,8192\)/);
  assert.match(body, /b\.resolution\.length>4000/);
  assert.match(body, /WHERE id=\? AND status=\?/);
  assert.match(body, /CASE_STATE_CONFLICT/);
});
