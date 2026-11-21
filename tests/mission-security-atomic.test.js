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
  assert.equal(await consumeMissionSecurityCode({ DB }, "security-1", "ARRIVAL", "hash-1"), true);
  assert.match(DB.calls[0].sql, /status='prepared'/);
  assert.match(DB.calls[0].sql, /arrival_used_at IS NULL/);
  assert.match(DB.calls[0].sql, /julianday\(arrival_expires_at\)>julianday\('now'\)/);
  assert.deepEqual(DB.calls[0].values, ["security-1", "hash-1"]);
});

test("end code consumption requires an in-progress mission and unused code", async () => {
  const DB = mockDb(1);
  assert.equal(await consumeMissionSecurityCode({ DB }, "security-2", "END", "hash-2"), true);
  assert.match(DB.calls[0].sql, /status='in_progress'/);
  assert.match(DB.calls[0].sql, /end_used_at IS NULL/);
  assert.match(DB.calls[0].sql, /julianday\(end_expires_at\)>julianday\('now'\)/);
});

test("a concurrent replay loses when the conditional update changes no row", async () => {
  const DB = mockDb(0);
  assert.equal(await consumeMissionSecurityCode({ DB }, "security-1", "ARRIVAL", "hash-1"), false);
});

test("invalid purpose and missing database fail closed without a query", async () => {
  const DB = mockDb(1);
  assert.equal(await consumeMissionSecurityCode({ DB }, "security-1", "OTHER", "hash-1"), false);
  assert.equal(await consumeMissionSecurityCode({}, "security-1", "ARRIVAL", "hash-1"), false);
  assert.equal(DB.calls.length, 0);
});


const workerSource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("mission presence and code verification fail closed until cryptographic device enrollment exists", () => {
  const presenceStart = workerSource.indexOf("async function securityPresence(request, env) {");
  const presenceEnd = workerSource.indexOf("\\nexport async function consumeMissionSecurityCode", presenceStart);
  const verifyStart = workerSource.indexOf("async function securityVerifyCode(request, env) {");
  const verifyEnd = workerSource.indexOf("\\nasync function securityResendCodes", verifyStart);
  assert.ok(presenceStart >= 0 && presenceEnd > presenceStart, "presence route must exist");
  assert.ok(verifyStart >= 0 && verifyEnd > verifyStart, "verification route must exist");
  const presence = workerSource.slice(presenceStart, presenceEnd);
  const verify = workerSource.slice(verifyStart, verifyEnd);
  for (const handler of [presence, verify]) {
    assert.match(handler, /getSessionUser\\(request, env\\)/);
    assert.match(handler, /requireRole\\(auth, \\['intervenant'\\]\\)/);
    assert.match(handler, /CRYPTOGRAPHIC_DEVICE_ENROLLMENT_REQUIRED/);
    assert.match(handler, /write_enabled: false/);
    assert.match(handler, /}, 503\\)/);
    assert.doesNotMatch(handler, /deviceHash|trusted_devices|consumeMissionSecurityCode|INSERT INTO|UPDATE /);
  }
  assert.doesNotMatch(workerSource, /request\\.headers\\.get\\('user-agent'\\).*sec-ch-ua/);
});
