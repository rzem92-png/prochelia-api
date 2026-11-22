import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { getSessionUser, logout } from "../src/index.js";

globalThis.crypto ??= webcrypto;

const token = "synthetic-session-token";
const tokenHash = createHash("sha256").update(token).digest("base64url");
const request = () => new Request("https://api.example.test/api/auth/me", {
  headers: { cookie: "prochelia_session=" + token }
});

test("session lookup requires an unexpired, non-revoked server-side session", async () => {
  let sqlSeen = "";
  const env = {
    DB: {
      prepare(sql) {
        sqlSeen = sql;
        return { bind(value) {
          assert.equal(value, tokenHash);
          return { async first() { return null; } };
        }};
      }
    }
  };
  assert.equal(await getSessionUser(request(), env), null);
  assert.match(sqlSeen, /s\.revoked_at IS NULL/);
  assert.match(sqlSeen, /s\.expires_at > CURRENT_TIMESTAMP/);
});

test("active session lookup still returns only the safe user projection", async () => {
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /s\.revoked_at IS NULL/);
        return { bind(value) {
          assert.equal(value, tokenHash);
          return { async first() {
            return {
              id: "synthetic-user", role: "client", email: "synthetic@example.test",
              first_name: "Synthetic", last_name: "User", phone: null, status: "active",
              created_at: "2026-11-18 00:00:00", updated_at: "2026-11-18 00:00:00",
              session_id: "synthetic-session"
            };
          }};
        }};
      }
    }
  };
  const auth = await getSessionUser(request(), env);
  assert.equal(auth.user.id, "synthetic-user");
  assert.equal(auth.session_id, "synthetic-session");
  assert.equal(auth.user.password_hash, undefined);
});

test("logout revokes the current session instead of deleting its audit record", async () => {
  let statement = "";
  let values = [];
  const env = {
    DB: {
      prepare(sql) {
        statement = sql;
        return { bind(...args) {
          values = args;
          return { async run() { return { success: true, meta: { changes: 1 } }; } };
        }};
      }
    }
  };
  const response = await logout(request(), env);
  assert.equal(response.status, 200);
  assert.match(statement, /UPDATE sessions/);
  assert.match(statement, /revoked_at = CURRENT_TIMESTAMP/);
  assert.match(statement, /revoked_reason = 'USER_LOGOUT'/);
  assert.match(statement, /revoked_at IS NULL/);
  assert.doesNotMatch(statement, /DELETE FROM sessions/);
  assert.deepEqual(values, [tokenHash]);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});

test("logout without a session cookie does not access D1", async () => {
  let calls = 0;
  const response = await logout(new Request("https://api.example.test/api/auth/logout"), {
    DB: { prepare() { calls += 1; throw new Error("No token should produce no DB query"); } }
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 0);
});


test("logout does not clear the session cookie when D1 cannot confirm revocation", async () => {
  const env = {
    DB: {
      prepare() {
        return { bind() {
          return { async run() { return { success: false, meta: { changes: 1 } }; } };
        }};
      }
    }
  };
  const response = await logout(request(), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "SESSION_REVOCATION_UNCONFIRMED");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("logout keeps the cookie and returns 503 when the D1 revocation call throws", async () => {
  const env = {
    DB: {
      prepare() {
        return { bind() {
          return { async run() { throw new Error("synthetic D1 outage"); } };
        }};
      }
    }
  };
  const response = await logout(request(), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "SESSION_REVOCATION_UNCONFIRMED");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("logout clears a stale cookie when D1 confirms an idempotent no-op revocation", async () => {
  const env = {
    DB: {
      prepare() {
        return { bind() {
          return { async run() { return { success: true, meta: { changes: 0 } }; } };
        }};
      }
    }
  };
  const response = await logout(request(), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).authenticated, false);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});
