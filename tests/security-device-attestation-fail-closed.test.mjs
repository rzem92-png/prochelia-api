import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { securityPresence } from "../src/index.js";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function authenticatedIntervenantEnv() {
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
                  id: "intervenant-user-1",
                  role: "intervenant",
                  email: "intervenant@example.test",
                  first_name: "Synthetic",
                  last_name: "Intervenant",
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

test("mission presence refuses spoofable User-Agent fingerprints before any trust write", async () => {
  const { env, statements } = authenticatedIntervenantEnv();
  const request = new Request("https://api.example.test/api/security/presence", {
    method: "POST",
    headers: {
      cookie: "prochelia_session=synthetic-session-token",
      "content-type": "application/json",
      "user-agent": "Forged Device/1.0",
      "sec-ch-ua": '"Not-A-Real-Browser";v="999"'
    },
    body: JSON.stringify({ mission_id: "synthetic-mission-1" })
  });
  const response = await securityPresence(request, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "DEVICE_ATTESTATION_REQUIRED");
  assert.equal(statements.length, 1, "only the authenticated session lookup is permitted");
  assert.match(statements[0], /FROM sessions s/);
});

test("mission presence does not create trusted_devices or update mission_security", () => {
  const start = source.indexOf("export async function securityPresence");
  const end = source.indexOf("\nexport async function consumeMissionSecurityCode", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /DEVICE_ATTESTATION_REQUIRED/);
  assert.doesNotMatch(body, /INSERT INTO trusted_devices/);
  assert.doesNotMatch(body, /UPDATE mission_security/);
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
