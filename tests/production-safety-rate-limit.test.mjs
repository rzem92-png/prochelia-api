import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  productionRateLimit,
  productionSubjectHash
} from "../src/index.js";

const PAGE_ORIGIN = "https://pages-proxy-2026-11-23.prochelia.pages.dev";

test("production subject hashes use the defined SHA-256 base64url helper", async () => {
  const first = await productionSubjectHash(
    new Request("https://api.example.test/api/auth/login", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    }),
    "/api/auth/login"
  );
  const same = await productionSubjectHash(
    new Request("https://api.example.test/api/auth/login", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    }),
    "/api/auth/login"
  );
  const different = await productionSubjectHash(
    new Request("https://api.example.test/api/auth/login", {
      headers: { "CF-Connecting-IP": "203.0.113.11" }
    }),
    "/api/auth/login"
  );

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(first, same);
  assert.notEqual(first, different);
});

test("rate limiting fails closed when schema is absent and performs no DDL or DML", async () => {
  const statements = [];
  const env = {
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind() { return this; },
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true })
        };
      }
    }
  };

  const result = await productionRateLimit(
    new Request("https://api.example.test/api/auth/login", { method: "POST" }),
    env
  );

  assert.equal(result.ok, false);
  assert.equal(result.response.status, 503);
  assert.equal((await result.response.json()).error, "RATE_LIMIT_SCHEMA_UNAVAILABLE");
  assert.ok(statements.length > 0);
  assert.ok(statements.every((sql) => !/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/i.test(sql)));
});

test("rate limiter uses read-only schema checks and DML only after schema readiness", async () => {
  const statements = [];
  const writes = [];
  const rateColumns = ["id", "bucket", "subject_hash", "window_start", "request_count"];
  const auditColumns = ["id", "event_type", "route", "subject_hash", "decision", "details_json"];
  const env = {
    DB: {
      prepare(sql) {
        statements.push(sql);
        let bound = [];
        return {
          bind(...values) { bound = values; return this; },
          first: async () => {
            if (sql.includes("sqlite_master")) return { name: bound[0] };
            if (sql.includes("SELECT request_count FROM security_rate_limits")) return null;
            return null;
          },
          all: async () => {
            if (sql.includes("PRAGMA table_info(security_rate_limits)")) {
              return { results: rateColumns.map((name) => ({ name })) };
            }
            if (sql.includes("PRAGMA table_info(production_security_events)")) {
              return { results: auditColumns.map((name) => ({ name })) };
            }
            return { results: [] };
          },
          run: async () => {
            writes.push({ sql, bound });
            return { success: true };
          }
        };
      }
    }
  };

  const result = await productionRateLimit(
    new Request("https://api.example.test/api/auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.12" }
    }),
    env
  );

  assert.equal(result.ok, true);
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /^INSERT INTO security_rate_limits/);
  assert.ok(statements.every((sql) => !/\b(CREATE|ALTER|DROP)\b/i.test(sql)));
});

test("anonymous tenant selection returns 401 before touching D1", async () => {
  let d1Calls = 0;
  const response = await worker.fetch(
    new Request("https://api.example.test/api/tenant/select", {
      method: "POST",
      headers: {
        Origin: PAGE_ORIGIN,
        "Content-Type": "application/json"
      },
      body: "{}"
    }),
    {
      APP_ENV: "preview",
      CORS_ORIGIN: PAGE_ORIGIN,
      DB: {
        prepare() {
          d1Calls += 1;
          throw new Error("D1 must not be touched for anonymous tenant selection");
        }
      }
    }
  );

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
  assert.equal(d1Calls, 0);
});
