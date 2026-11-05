import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const allowedOrigin = "https://prochelia.pages.dev";
const endpoint = "https://prochelia-api.rzem92.workers.dev/api/auth/login";

test("CORS preflight for JSON login succeeds without accessing D1", async () => {
  const env = new Proxy({}, {
    get(_target, property) {
      if (property === "DB") throw new Error("Preflight must not access D1");
      return undefined;
    }
  });
  const request = new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-idempotency-key"
    }
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") || "", /Content-Type/);
});

test("Fetch Metadata blocks every unsafe cross-site HTTP method", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const env = new Proxy({}, {
      get(_target, property) {
        if (property === "DB") throw new Error("Must block before D1");
        return undefined;
      }
    });
    const response = await worker.fetch(new Request(endpoint, {
      method,
      headers: { "Sec-Fetch-Site": "cross-site" }
    }), env);
    assert.equal(response.status, 403, method);
    assert.equal((await response.json()).error, "CROSS_SITE_REQUEST_BLOCKED", method);
  }
});

test("unapproved browser origin is rejected", async () => {
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

test("cross-site mutation is blocked by Fetch Metadata before D1/rate-limit", async () => {
  const env = new Proxy({}, {
    get(_target, property) {
      if (property === "DB") throw new Error("Cross-site request must be blocked before D1");
      return undefined;
    }
  });
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: {
      "Sec-Fetch-Site": "cross-site",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "test@example.com", password: "not-a-real-password" })
  }), env);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "CROSS_SITE_REQUEST_BLOCKED");
  assert.equal(typeof body.version, "string");
  assert.ok(body.version.length > 0);
});

test("unapproved preflight header is rejected", async () => {
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

test("allowed browser request receives credentialed CORS headers even on a safe failure", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: {
      Origin: allowedOrigin,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "test@example.com", password: "not-a-real-password" })
  }), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});
