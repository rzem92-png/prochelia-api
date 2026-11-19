import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Missing source section: ${startMarker}`);
  return source.slice(start, end);
}

test("national continuity schema guard is read-only and fails closed when tables are missing", () => {
  assert.doesNotMatch(source, /ensureNationalContinuitySchema/);
  const guard = section("async function requireNationalContinuitySchema", "\nfunction b64(");
  assert.match(guard, /SELECT name FROM sqlite_master/);
  for (const table of ["platform_scale_config", "backup_runs", "backup_objects"]) {
    assert.ok(guard.includes(table), `missing required schema table: ${table}`);
  }
  assert.match(guard, /NATIONAL_CONTINUITY_SCHEMA_NOT_READY/);
  assert.match(guard, /result\.success!==true/);
  assert.match(guard, /Array\.isArray\(result\.results\)/);
  assert.match(guard, /NATIONAL_CONTINUITY_SCHEMA_LOOKUP_FAILED/);
  assert.doesNotMatch(guard, /\b(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
});

test("backup and continuity status handlers require pre-provisioned schema without creating it", () => {
  const backup = section("async function runNationalBackup", "\nasync function nationalScaleStatus");
  const scale = section("async function nationalScaleStatus", "\nasync function backupStatus");
  const status = section("async function backupStatus", "\nconst __procheliaNationalHandle");
  assert.match(backup, /await requireNationalContinuitySchema\(env\)/);
  assert.match(scale, /await requireNationalContinuitySchema\(env\)/);
  assert.match(status, /await requireNationalContinuitySchema\(env\)/);
  for (const body of [scale, status]) {
    assert.doesNotMatch(body, /\b(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
  }
});

test("backup status never claims a configured schedule, retention or HMAC attestation without independent evidence", () => {
  const scale = section("async function nationalScaleStatus", "\nasync function backupStatus");
  const status = section("async function backupStatus", "\nconst __procheliaNationalHandle");
  assert.match(scale, /automatic:false/);
  assert.match(scale, /scheduleStatus:'REQUIRES_EXTERNAL_VERIFICATION'/);
  assert.match(scale, /retentionStatus:'UNVERIFIED'/);
  assert.match(scale, /attestationStatus:'UNVERIFIED'/);
  assert.match(status, /automatic:false/);
  assert.match(status, /frequency:null/);
  assert.match(status, /retentionDays:null/);
  assert.match(status, /retentionStatus:'UNVERIFIED'/);
  assert.match(status, /attestationStatus:'UNVERIFIED'/);
  assert.doesNotMatch(scale + status, /automatic:true|frequency:'DAILY'|retentionDays:90/);
});

test("manual backup remains an explicit GERANTE-only POST action", () => {
  const routes = section("const __procheliaNationalHandle = handle", "/* ============================================================================\n   PROCHÉLIA — COMPLÉMENT MAÎTRE");
  assert.match(routes, /request\.method==='POST'&&url\.pathname==='\/api\/system\/backup\/run'/);
  assert.match(routes, /String\(auth\.user\.role\|\|''\)\.toUpperCase\(\)!=='GERANTE'/);
  assert.match(routes, /runNationalBackup\(env,'MANUAL'\)/);
});
