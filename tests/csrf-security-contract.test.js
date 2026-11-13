import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../src/index.js";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("session CSRF endpoint is authenticated and never cacheable", () => {
  const csrf = source.slice(source.indexOf("async function csrfTokenForSession"), source.indexOf("function requireRole"));
  assert.match(csrf, /name:'HMAC',hash:'SHA-256'/);
  assert.match(csrf, /PROCHELIA-CSRF-v1:/);
  assert.match(csrf, /cache-control':'no-store/);
  assert.match(source, /url\.pathname === '\/api\/auth\/csrf'/);
  assert.match(source, /return authCsrf\(request, env\)/);
  assert.match(source, /function constantTimeStringEqual\(/);
});

test("cookie-authenticated mutations require a valid session-bound CSRF header", () => {
  const handler = source.slice(source.indexOf("async function handle(request,env)"));
  assert.match(handler, /csrfExemptPaths = new Set\(\['\/api\/auth\/login', '\/api\/auth\/bootstrap', '\/api\/payments\/webhook'\]\)/);
  assert.match(handler, /getSessionToken\(request\)/);
  assert.match(handler, /csrfTokenForSession\(auth\)/);
  assert.match(handler, /constantTimeStringEqual\(supplied, expected\)/);
  assert.match(handler, /CSRF_TOKEN_INVALID/);
});

test("mutations require explicit Origin allowlisting except narrowly guarded server callbacks", () => {
  const policy = source.slice(source.indexOf("function isMutatingMethod"), source.indexOf("async function ensureCommercialRecruitmentSchema"));
  assert.match(policy, /function originlessMutationAllowed/);
  assert.match(policy, /url\.pathname==='\/api\/auth\/bootstrap'/);
  assert.match(policy, /url\.pathname==='\/api\/payments\/webhook'/);
  assert.match(policy, /return !isMutatingMethod\(request\.method\) \|\| originlessMutationAllowed\(request,env\)/);
  assert.match(policy, /if\(!configured\) return false/);
  assert.doesNotMatch(policy, /const defaults=/);
});

test("browser session token remains in an HttpOnly Secure cookie", () => {
  assert.match(source, /function getSessionToken\(request\)/);
  assert.match(source, /return getCookie\(request, SESSION_COOKIE\)/);
  assert.match(source, /HttpOnly; Secure; SameSite=Lax/);
});

const TEST_ORIGIN = "https://preview.prochelia.test";
const USER_ROW = Object.freeze({
  id: "user-test-1",
  role: "GERANTE",
  email: "manager@example.test",
  first_name: "Test",
  last_name: "Manager",
  phone: null,
  status: "active",
  created_at: "2026-01-01 00:00:00",
  updated_at: "2026-01-01 00:00:00"
});

function makeEnv({ sessionId = "session-test-1", sessionRow = USER_ROW } = {}) {
  let sessionLookups = 0;
  const row = sessionRow ? { ...sessionRow, session_id: sessionId } : null;
  const env = {
    CORS_ORIGIN: TEST_ORIGIN,
    TEST_MODE: true,
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("FROM sessions s")) {
                  sessionLookups += 1;
                  return row;
                }
                return null;
              },
              async run() { return { meta: { changes: 1 } }; }
            };
          }
        };
      }
    }
  };
  return { env, getSessionLookups: () => sessionLookups };
}

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function deriveCsrfToken(sessionToken, sessionId) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionToken));
  const tokenHash = base64url(new Uint8Array(digest));
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(tokenHash),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const message = new TextEncoder().encode(`PROCHELIA-CSRF-v1:${sessionId}`);
  return base64url(new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, message)));
}

function cookieHeader(token) {
  return `prochelia_session=${encodeURIComponent(token)}`;
}

test("runtime: authenticated CSRF endpoint returns a session-bound no-store token", async () => {
  const token = "test-session-secret-A";
  const sessionId = "session-A";
  const { env } = makeEnv({ sessionId });
  const response = await worker.fetch(new Request("https://api.preview.test/api/auth/csrf", {
    headers: { cookie: cookieHeader(token) }
  }), env);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") || "", /no-store/i);
  assert.match(response.headers.get("pragma") || "", /no-cache/i);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.csrf_token, await deriveCsrfToken(token, sessionId));
});

test("runtime: unauthenticated, expired or revoked sessions cannot obtain a CSRF token", async () => {
  const missing = makeEnv({ sessionRow: null });
  const response = await worker.fetch(new Request("https://api.preview.test/api/auth/csrf", {
    headers: { cookie: cookieHeader("expired-or-revoked-session") }
  }), missing.env);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");

  const inactive = makeEnv({ sessionRow: { ...USER_ROW, status: "disabled" } });
  const inactiveResponse = await worker.fetch(new Request("https://api.preview.test/api/auth/csrf", {
    headers: { cookie: cookieHeader("inactive-session") }
  }), inactive.env);
  assert.equal(inactiveResponse.status, 401);
});

test("runtime: missing and invalid CSRF tokens block cookie-authenticated mutations", async () => {
  const token = "test-session-secret-B";
  const { env } = makeEnv({ sessionId: "session-B" });
  for (const csrf of [null, "wrong-csrf-token-value"]) {
    const headers = {
      origin: TEST_ORIGIN,
      cookie: cookieHeader(token),
      "content-type": "application/json"
    };
    if (csrf !== null) headers["x-csrf-token"] = csrf;
    const request = new Request("https://api.preview.test/api/__csrf_contract_probe__", {
      method: "POST",
      headers,
      body: JSON.stringify({ amount_eur: 1, entry_type: "TEST" })
    });
    assert.equal(request.headers.get("cookie"), cookieHeader(token), "test runtime must preserve the session cookie");
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 403, JSON.stringify(await response.clone().json()));
    assert.equal((await response.json()).error, "CSRF_TOKEN_INVALID");
  }
});

test("runtime: a CSRF token from another session is rejected", async () => {
  const tokenA = "test-session-secret-session-A";
  const tokenB = "test-session-secret-session-B";
  const csrfA = await deriveCsrfToken(tokenA, "session-A");
  const { env } = makeEnv({ sessionId: "session-B" });

  const response = await worker.fetch(new Request("https://api.preview.test/api/__csrf_contract_probe__", {
    method: "POST",
    headers: {
      origin: TEST_ORIGIN,
      cookie: cookieHeader(tokenB),
      "x-csrf-token": csrfA,
      "content-type": "application/json"
    },
    body: JSON.stringify({ amount_eur: 1, entry_type: "TEST" })
  }), env);

  assert.equal(response.status, 403, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).error, "CSRF_TOKEN_INVALID");
});

test("runtime: valid session-bound CSRF passes the CSRF gate, while an untrusted Origin is rejected first", async () => {
  const token = "test-session-secret-C";
  const sessionId = "session-C";
  const csrf = await deriveCsrfToken(token, sessionId);
  const valid = makeEnv({ sessionId });

  const accepted = await worker.fetch(new Request("https://api.preview.test/api/__csrf_contract_probe__", {
    method: "POST",
    headers: {
      origin: TEST_ORIGIN,
      cookie: cookieHeader(token),
      "x-csrf-token": csrf,
      "content-type": "application/json"
    },
    body: "{}"
  }), valid.env);
  assert.notEqual((await accepted.clone().json()).error, "CSRF_TOKEN_INVALID");
  assert.equal(valid.getSessionLookups(), 1);

  const untrusted = makeEnv({ sessionId });
  const rejected = await worker.fetch(new Request("https://api.preview.test/api/__csrf_contract_probe__", {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      cookie: cookieHeader(token),
      "x-csrf-token": csrf,
      "content-type": "application/json"
    },
    body: "{}"
  }), untrusted.env);
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).error, "ORIGIN_NOT_ALLOWED");
  assert.equal(untrusted.getSessionLookups(), 0);
});

test("runtime: originless browser mutations fail closed", async () => {
  const { env, getSessionLookups } = makeEnv();
  const response = await worker.fetch(new Request("https://api.preview.test/api/__csrf_contract_probe__", {
    method: "POST",
    headers: {
      cookie: cookieHeader("test-session-secret-D"),
      "content-type": "application/json"
    },
    body: "{}"
  }), env);

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
  assert.equal(getSessionLookups(), 0);
});
