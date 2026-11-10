import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("all support/system authorization helpers reference the real session resolver", () => {
  assert.equal(/\bgetAuth\s*\(/.test(source), false, "undefined getAuth() calls must not remain");
  assert.match(source, /async function supportAuth\(request,env\)[\s\S]*?getSessionUser\(request,env\)/);
});

test("system scale and backup routes require a manager session", () => {
  const routes = source.slice(source.indexOf("const __procheliaNationalHandle = handle"));
  assert.equal((routes.match(/getSessionUser\(request,env\)/g) || []).length >= 3, true);
  assert.match(routes, /auth\.user\.role.*GERANTE/);
});

test("originless mutating requests are rejected before reaching business handlers", async () => {
  const { default: worker } = await import("../src/index.js");
  const response = await worker.fetch(new Request("https://prochelia-api.example/api/missions/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mission_id: "not-used" })
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("malformed session cookie is treated as absent and logout still clears it", async () => {
  const { default: worker } = await import("../src/index.js");
  const DB = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("SELECT request_count FROM security_rate_limits")) return null;
          return null;
        },
        async run() { return { meta: { changes: 1 } }; },
        async all() { return { results: [] }; }
      };
    }
  };
  const response = await worker.fetch(new Request("https://prochelia-api.example/api/auth/logout", {
    method: "POST",
    headers: {
      origin: "https://prochelia.pages.dev",
      cookie: "prochelia_session=%E0%A4%A"
    }
  }), { DB });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).authenticated, false);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});

test("originless bootstrap is allowed only with the exact configured bearer token", async () => {
  const { default: worker } = await import("../src/index.js");
  const env = {
    BOOTSTRAP_TOKEN: "test-bootstrap-secret",
    DB: {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("SELECT request_count FROM security_rate_limits")) return null;
            if (sql.includes("SELECT COUNT(*) AS total FROM users")) return { total: 1 };
            return null;
          },
          async run() { return { meta: { changes: 1 } }; },
          async all() { return { results: [] }; }
        };
      }
    }
  };
  const denied = await worker.fetch(new Request("https://prochelia-api.example/api/auth/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  }), env);
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error, "ORIGIN_NOT_ALLOWED");

  const authorized = await worker.fetch(new Request("https://prochelia-api.example/api/auth/bootstrap", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-bootstrap-secret"
    },
    body: "{}"
  }), env);
  assert.equal(authorized.status, 409);
  assert.equal((await authorized.json()).error, "BOOTSTRAP_ALREADY_USED");
});

