import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function makeEnv() {
  return {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() { return null; },
              async run() { return { meta: { changes: 0 } }; }
            };
          }
        };
      }
    }
  };
}

test("malformed session cookie encodings fail closed as unauthenticated", async () => {
  for (const value of ["%", "%ZZ", "%E0%A4%A"]) {
    const response = await worker.fetch(new Request("https://api.preview.test/api/auth/me", {
      headers: { cookie: `prochelia_session=${value}` }
    }), makeEnv());

    assert.equal(response.status, 401, `cookie value ${value} must not cause a server error`);
    const payload = await response.json();
    assert.equal(payload.authenticated, false);
    assert.equal(payload.error, "UNAUTHENTICATED");
  }
});

test("a malformed unrelated cookie does not prevent a valid session cookie from being parsed", async () => {
  const response = await worker.fetch(new Request("https://api.preview.test/api/auth/me", {
    headers: { cookie: "theme=%ZZ; prochelia_session=valid-session-token" }
  }), makeEnv());

  // The valid token reaches the session lookup; the mocked D1 returns no row.
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});
