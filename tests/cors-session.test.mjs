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

test("unapproved Origin blocks a mutating request before database access", async () => {
  const env = new Proxy({}, {
    get(_target, property) {
      if (property === "DB") throw new Error("Unapproved Origin must be blocked before D1");
      return undefined;
    }
  });
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: {
      Origin: "https://attacker.example",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "test@example.test", password: "synthetic" })
  }), env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("configured CORS allowlist replaces built-in origins", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST"
    }
  }), { CORS_ORIGIN: "https://custom-prochelia.example" });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("CORS preflight rejects unsupported mutation methods", async () => {
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const response = await worker.fetch(new Request(endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": method
      }
    }), {});
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("allow"), "GET, HEAD, POST, OPTIONS", method);
  }
});


test("malformed percent-encoded session cookie fails closed instead of crashing", async () => {
  const response = await worker.fetch(new Request("https://prochelia-api.rzem92.workers.dev/api/auth/me", {
    headers: { Cookie: "prochelia_session=%E0%A4%A" }
  }), {});
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});


test("duplicate session cookie names fail closed to avoid cookie tossing ambiguity", async () => {
  const response = await worker.fetch(new Request("https://prochelia-api.rzem92.workers.dev/api/auth/me", {
    headers: { Cookie: "prochelia_session=first; prochelia_session=second" }
  }), {});
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});


test("CORS allowlist matches exact origins and rejects lookalike/null origins", async () => {
  const rejectedOrigins = [
    "https://prochelia.pages.dev.attacker.example",
    "https://evil-prochelia.pages.dev",
    "https://prochelia.pages.dev:443",
    "null"
  ];
  for (const origin of rejectedOrigins) {
    const response = await worker.fetch(new Request(endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST"
      }
    }), {});
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), null, origin);
  }
});

test("CORS configured allowlist accepts exact comma-separated origins only", async () => {
  const configured = "https://app.prochelia.example, https://staging.prochelia.example";
  for (const origin of ["https://app.prochelia.example", "https://staging.prochelia.example"]) {
    const response = await worker.fetch(new Request(endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST"
      }
    }), { CORS_ORIGIN: configured });
    assert.equal(response.status, 204, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  }
  const rejected = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: "https://attacker.prochelia.example",
      "Access-Control-Request-Method": "POST"
    }
  }), { CORS_ORIGIN: configured });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
});


test("trusted allowlisted Pages Origin may use cross-site cookie session transport", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: {
      Origin: allowedOrigin,
      "Sec-Fetch-Site": "cross-site",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "test@example.com", password: "synthetic-password" })
  }), {});
  // The request must pass the Fetch Metadata gate and reach the API handler.
  // With no D1 binding, the expected safe result is DATABASE_UNAVAILABLE.
  assert.equal(response.status, 503);
  assert.notEqual((await response.json()).error, "CROSS_SITE_REQUEST_BLOCKED");
});

test("cross-site mutation without Origin fails closed before database access", async () => {
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
    body: JSON.stringify({ email: "test@example.com", password: "synthetic-password" })
  }), env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "CROSS_SITE_REQUEST_BLOCKED");
});
