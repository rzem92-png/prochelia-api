import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const allowedOrigin = "https://feat-supra-control-center-v1.prochelia.pages.dev";
const endpoint = "https://prochelia-api.rzem92.workers.dev/api/auth/login";

test("credentialed CORS preflight succeeds without touching D1", async () => {
  const env = new Proxy({}, {
    get(_target, property) {
      if (property === "DB") throw new Error("Preflight must not access D1");
      return undefined;
    }
  });
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-idempotency-key"
    }
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") || "", /Content-Type/);
});

test("unapproved browser origin is rejected without CORS permission", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: "https://attacker.example",
      "Access-Control-Request-Method": "POST"
    }
  }), {});
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("unapproved preflight headers are rejected", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "x-evil-header"
    }
  }), {});
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("approved browser requests receive credentialed CORS headers on safe failures", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: { Origin: allowedOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "not-a-real-password" })
  }), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("cookie-authenticated writes without Origin are blocked against CSRF", async () => {
  const response = await worker.fetch(new Request("https://prochelia-api.rzem92.workers.dev/api/auth/logout", {
    method: "POST",
    headers: { Cookie: "prochelia_session=opaque-session-value" }
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "CSRF_ORIGIN_REQUIRED");
});

test("session cookie remains HttpOnly and Secure with cross-origin SameSite policy", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /HttpOnly; Secure; SameSite=None/);
});
