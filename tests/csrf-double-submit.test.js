import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORIGIN = "https://prochelia.pages.dev";
const request = (path, { method = "GET", headers = {} } = {}) =>
  new Request(`https://api.example.test${path}`, { method, headers });

test("CSRF bootstrap issues a strong HttpOnly SameSite=Strict cookie", async () => {
  const response = await worker.fetch(request("/api/auth/csrf"), {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.match(payload.csrf_token, /^[A-Za-z0-9_-]{43}$/);
  const cookie = response.headers.get("set-cookie") || "";
  assert.match(cookie, /prochelia_csrf=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\/api/i);
  assert.match(cookie, /Max-Age=600/i);
});

test("CSRF bootstrap reuses a valid cookie to avoid parallel-request token races", async () => {
  const token = "A".repeat(43);
  const response = await worker.fetch(request("/api/auth/csrf", {
    headers: { Cookie: `prochelia_csrf=${token}` }
  }), {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.csrf_token, token);
  assert.equal(response.headers.has("set-cookie"), false);
});

test("browser mutation without CSRF cookie and header is rejected before D1 access", async () => {
  const response = await worker.fetch(request("/api/auth/logout", {
    method: "POST",
    headers: { Origin: ORIGIN }
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "CSRF_TOKEN_INVALID");
});

test("browser mutation with mismatched CSRF values is rejected", async () => {
  const response = await worker.fetch(request("/api/auth/logout", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Cookie: `prochelia_csrf=${"A".repeat(43)}`,
      "X-CSRF-Token": "B".repeat(43)
    }
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "CSRF_TOKEN_INVALID");
});

test("browser mutation with matching CSRF values passes CSRF gate", async () => {
  const token = "C".repeat(43);
  const response = await worker.fetch(request("/api/auth/logout", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Cookie: `prochelia_csrf=${token}`,
      "X-CSRF-Token": token
    }
  }), {});
  // No DB binding is supplied in this isolated unit test. Reaching this
  // response proves the CSRF gate accepted the request before the D1 gate.
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "DATABASE_UNAVAILABLE");
});

test("CSRF bootstrap rejects untrusted browser origins", async () => {
  const response = await worker.fetch(request("/api/auth/csrf", {
    headers: { Origin: "https://attacker.invalid" }
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("CSRF bootstrap rejects non-GET methods", async () => {
  const response = await worker.fetch(request("/api/auth/csrf", {
    method: "POST",
    headers: { Origin: ORIGIN }
  }), {});
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error, "METHOD_NOT_ALLOWED");
});
