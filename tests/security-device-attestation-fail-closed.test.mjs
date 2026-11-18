import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  securityPresence,
  securityPrepareMission,
  securityVerifyCode,
  securityResendCodes,
  securityStatus
} from "../src/index.js";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function authenticatedEnv(role) {
  const statements = [];
  const env = {
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind() {
            return {
              async first() {
                return {
                  id: "synthetic-user-1",
                  role,
                  email: "synthetic@example.test",
                  first_name: "Synthetic",
                  last_name: "User",
                  phone: null,
                  status: "active",
                  created_at: "2026-11-18 00:00:00",
                  updated_at: "2026-11-18 00:00:00",
                  session_id: "synthetic-session-1"
                };
              }
            };
          }
        };
      }
    }
  };
  return { env, statements };
}

function request(path, body = {}) {
  return new Request("https://api.example.test" + path, {
    method: "POST",
    headers: {
      cookie: "prochelia_session=synthetic-session-token",
      "content-type": "application/json",
      "user-agent": "Forged Device/1.0",
      "sec-ch-ua": '"Not-A-Real-Browser";v="999"'
    },
    body: JSON.stringify(body)
  });
}

test("mission presence refuses spoofable User-Agent fingerprints before any trust write", async () => {
  const { env, statements } = authenticatedEnv("intervenant");
  const response = await securityPresence(request("/api/security/presence", { mission_id: "synthetic-mission-1" }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "DEVICE_ATTESTATION_REQUIRED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is permitted");
  assert.match(statements[0], /FROM sessions s/);
});

test("mission code verification refuses before reading or consuming a code without device proof", async () => {
  const { env, statements } = authenticatedEnv("intervenant");
  const response = await securityVerifyCode(request("/api/security/code/verify", {
    mission_id: "synthetic-mission-1", purpose: "ARRIVAL", code: "123456"
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "DEVICE_ATTESTATION_REQUIRED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is permitted");
});

test("mission security preparation refuses before creating or delivering one-time codes", async () => {
  const { env, statements } = authenticatedEnv("gerante");
  const response = await securityPrepareMission(request("/api/security/mission/prepare", {
    mission_id: "synthetic-mission-1", client_id: "synthetic-client-1", intervenant_id: "synthetic-provider-1"
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "DEVICE_ATTESTATION_REQUIRED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is permitted");
});

test("mission code resend refuses before reading or mutating prepared codes", async () => {
  const { env, statements } = authenticatedEnv("gerante");
  const response = await securityResendCodes(request("/api/security/resend", { mission_id: "synthetic-mission-1" }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "DEVICE_ATTESTATION_REQUIRED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is permitted");
});

test("security status reports device attestation and mission verification as disabled", async () => {
  const { env, statements } = authenticatedEnv("gerante");
  const response = await securityStatus(request("/api/security/status"), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.security.device, "cryptographic_attestation_required");
  assert.equal(body.security.presence, "disabled");
  assert.equal(body.security.mission_code_verification, "disabled");
  assert.equal(body.security.audit_events, null);
  assert.equal(statements.length, 1, "status must not trigger runtime schema creation or business reads");
});

test("mission trust routes do not create trusted_devices or update mission_security", () => {
  const checks = [
    ["export async function securityPresence", "\nexport async function consumeMissionSecurityCode"],
    ["export async function securityVerifyCode", "\nasync function securityResendCodes"],
    ["export async function securityPrepareMission", "\nexport function isMissionPresenceFresh"],
    ["export async function securityResendCodes", "\nasync function securityClientCode"]
  ];
  for (const [startMarker, endMarker] of checks) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const body = source.slice(start, end);
    assert.match(body, /DEVICE_ATTESTATION_REQUIRED/);
    assert.doesNotMatch(body, /INSERT INTO trusted_devices|UPDATE mission_security|deviceHash/);
  }
  assert.doesNotMatch(source, /deviceHash\(request,auth\.user\.id\)/);
});

test("unauthenticated mission presence remains rejected", async () => {
  let databaseCalls = 0;
  const env = { DB: { prepare() { databaseCalls += 1; throw new Error("No session cookie means no DB query"); } } };
  const response = await securityPresence(new Request("https://api.example.test/api/security/presence", { method: "POST" }), env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
  assert.equal(databaseCalls, 0);
});
