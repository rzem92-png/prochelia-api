import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consumeMissionSecurityCode } from "../src/index.js";

function mockDb(changes) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return { async run() { calls.push({ sql, values }); return { meta: { changes } }; } };
        }
      };
    }
  };
}

test("arrival code consumption is a single conditional update", async () => {
  const DB = mockDb(1);
  assert.equal(await consumeMissionSecurityCode({ DB }, "tenant-a", "security-1", "ARRIVAL", "hash-1"), true);
  assert.match(DB.calls[0].sql, /status='prepared'/);
  assert.match(DB.calls[0].sql, /arrival_used_at IS NULL/);
  assert.match(DB.calls[0].sql, /julianday\(arrival_expires_at\)>julianday\('now'\)/);
  assert.match(DB.calls[0].sql, /tenant_id=\?/);
  assert.deepEqual(DB.calls[0].values, ["security-1", "tenant-a", "hash-1"]);
});

test("end code consumption requires an in-progress mission and unused code", async () => {
  const DB = mockDb(1);
  assert.equal(await consumeMissionSecurityCode({ DB }, "tenant-a", "security-2", "END", "hash-2"), true);
  assert.match(DB.calls[0].sql, /status='in_progress'/);
  assert.match(DB.calls[0].sql, /end_used_at IS NULL/);
  assert.match(DB.calls[0].sql, /julianday\(end_expires_at\)>julianday\('now'\)/);
});

test("a concurrent replay loses when the conditional update changes no row", async () => {
  const DB = mockDb(0);
  assert.equal(await consumeMissionSecurityCode({ DB }, "tenant-a", "security-1", "ARRIVAL", "hash-1"), false);
});

test("invalid purpose and missing database fail closed without a query", async () => {
  const DB = mockDb(1);
  assert.equal(await consumeMissionSecurityCode({ DB }, "tenant-a", "security-1", "OTHER", "hash-1"), false);
  assert.equal(await consumeMissionSecurityCode({}, "tenant-a", "security-1", "ARRIVAL", "hash-1"), false);
  assert.equal(await consumeMissionSecurityCode({ DB }, "", "security-1", "ARRIVAL", "hash-1"), false);
  assert.equal(DB.calls.length, 0);
});


const workerSource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("mission presence and code verification fail closed until cryptographic device enrollment exists", () => {
  const newline = String.fromCharCode(10);
  const presenceStart = workerSource.indexOf("async function securityPresence(request, env) {");
  const presenceEnd = workerSource.indexOf(newline + "export async function consumeMissionSecurityCode", presenceStart);
  const verifyStart = workerSource.indexOf("async function securityVerifyCode(request, env) {");
  const verifyEnd = workerSource.indexOf(newline + "async function securityResendCodes", verifyStart);
  assert.ok(presenceStart >= 0 && presenceEnd > presenceStart, "presence route must exist");
  assert.ok(verifyStart >= 0 && verifyEnd > verifyStart, "verification route must exist");
  const presence = workerSource.slice(presenceStart, presenceEnd);
  const verify = workerSource.slice(verifyStart, verifyEnd);
  for (const handler of [presence, verify]) {
    assert.ok(handler.includes("getSessionUser(request, env)"));
    assert.ok(handler.includes("requireRole(auth, ['intervenant'])"));
    assert.ok(handler.includes("CRYPTOGRAPHIC_DEVICE_ENROLLMENT_REQUIRED"));
    assert.ok(handler.includes("write_enabled: false"));
    assert.ok(handler.includes("}, 503);"));
    assert.doesNotMatch(handler, /deviceHash|trusted_devices|consumeMissionSecurityCode|INSERT INTO|UPDATE /);
  }
  assert.equal(workerSource.includes("request.headers.get('user-agent')"), false);
  assert.equal(workerSource.includes("request.headers.get('sec-ch-ua')"), false);
});

test("security status never claims device binding or presence while cryptographic enrollment is blocked", () => {
  const statusStart = workerSource.indexOf("async function securityStatus(request, env) {");
  const statusEnd = workerSource.indexOf("/*", statusStart);
  assert.ok(statusStart >= 0 && statusEnd > statusStart, "security status route must exist");
  const status = workerSource.slice(statusStart, statusEnd);
  assert.match(status, /device:'cryptographic_enrollment_required'/);
  assert.match(status, /presence:'blocked'/);
  assert.match(status, /mission_code_verification:'blocked'/);
  assert.match(status, /schema_ready:schemaReady/);
  assert.match(status, /write_enabled:false/);
  assert.doesNotMatch(status, /ensureSecuritySchema|CREATE TABLE|\\.run\\(/);
  assert.doesNotMatch(status, /device:'bound'|presence:'recorded'/);
  assert.doesNotMatch(status, /SELECT COUNT\(\*\).*security_audit|audit_events/);
  assert.match(status, /user:\{id:auth\.user\.id,role:auth\.user\.role\}/);
});


test("mission security preparation is tenant-scoped and verifies the intervenant user identity", () => {
  const start = workerSource.indexOf("async function securityPrepareMission(request, env) {");
  const end = workerSource.indexOf("async function securityPresence(request, env) {", start);
  assert.ok(start >= 0 && end > start, "mission preparation route must exist");
  const handler = workerSource.slice(start, end);
  assert.match(handler, /resolveTenantContext\(request, env, auth\)/);
  assert.match(handler, /tenantContext\.tenant\.id/);
  assert.match(handler, /JOIN clients c ON c\.id=m\.client_id AND c\.tenant_id=m\.tenant_id/);
  assert.match(handler, /JOIN intervenants i ON i\.id=m\.intervenant_id AND i\.tenant_id=m\.tenant_id/);
  assert.match(handler, /WHERE m\.id=\? AND m\.tenant_id=\? AND m\.client_id=\? AND m\.intervenant_id=\?/);
  assert.match(handler, /requireVerifiedIntervenant\(env,assignment\.intervenant_user_id,tenantId\)/);
  assert.doesNotMatch(handler, /requireVerifiedIntervenant\(env,intervenantId\)/);
  assert.match(handler, /MISSION_TENANT_ASSIGNMENT_NOT_FOUND/);
});


test("security schema readiness is read-only and requires tenant-scoped columns", () => {
  const start = workerSource.indexOf("async function securitySchemaReady(env) {");
  const end = workerSource.indexOf("\nfunction securityCode()", start);
  assert.ok(start >= 0 && end > start, "security schema readiness helper must exist");
  const helper = workerSource.slice(start, end);
  assert.match(helper, /tableColumns\(env, table\)/);
  assert.match(helper, /identity_verifications:[\s\S]*tenant_id/);
  assert.match(helper, /mission_security:[\s\S]*tenant_id/);
  assert.match(helper, /mission_security_attempts:[\s\S]*tenant_id/);
  assert.match(helper, /security_audit:[\s\S]*tenant_id/);
  assert.doesNotMatch(helper, /CREATE TABLE|CREATE INDEX|INSERT INTO|\.run\(/);
  assert.doesNotMatch(workerSource, /ensureSecuritySchema/);
});

test("security audit and mission-security reads/writes are tenant-scoped", () => {
  const auditStart = workerSource.indexOf("async function securityAudit(env, tenantId,");
  const auditEnd = workerSource.indexOf("\n}", auditStart);
  assert.ok(auditStart >= 0 && auditEnd > auditStart);
  const audit = workerSource.slice(auditStart, auditEnd);
  assert.match(audit, /metadata_json,tenant_id/);
  assert.match(audit, /SECURITY_AUDIT_TENANT_REQUIRED/);

  const prepareStart = workerSource.indexOf("async function securityPrepareMission(request, env) {");
  const prepareEnd = workerSource.indexOf("async function securityPresence(request, env) {", prepareStart);
  const prepare = workerSource.slice(prepareStart, prepareEnd);
  assert.match(prepare, /WHERE mission_id=\? AND tenant_id=\?/);
  assert.match(prepare, /mission_security \(id,mission_id,client_id,intervenant_id,tenant_id,/);
  assert.match(prepare, /securityAudit\(env,tenantId,/);

  const resendStart = workerSource.indexOf("async function securityResendCodes(request, env) {");
  const resendEnd = workerSource.indexOf("async function securityClientCode", resendStart);
  const resend = workerSource.slice(resendStart, resendEnd);
  assert.match(resend, /resolveTenantContext\(request,env,auth\)/);
  assert.match(resend, /s\.tenant_id=\?/);
  assert.match(resend, /c\.user_id=\?/);
});
