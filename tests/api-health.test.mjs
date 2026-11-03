import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const url = "https://prochelia-api-preview.rzem92.workers.dev/api/health";

test("health endpoint fails closed when D1 binding is absent", async () => {
  const response = await worker.fetch(new Request(url), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.database, false);
  assert.equal(body.service, "PROCHÉLIA API");
});

test("health endpoint reports healthy only after SELECT 1 succeeds", async () => {
  let sqlSeen = "";
  const env = {
    DB: {
      prepare(sql) {
        sqlSeen = sql;
        return {
          async first() { return { ok: 1 }; }
        };
      }
    }
  };

  const response = await worker.fetch(new Request(url), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
    assert.match(response.headers.get("content-type") || "", /application\/json/i);
  assert.equal(sqlSeen.trim(), "SELECT 1 AS ok");
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.database, true);
  assert.equal(body.service, "PROCHÉLIA API");
  assert.equal(typeof body.version, "string");
});

test("health endpoint returns unhealthy when the D1 health query does not confirm ok=1", async () => {
  const env = {
    DB: {
      prepare() {
        return { async first() { return { ok: 0 }; } };
      }
    }
  };
  const response = await worker.fetch(new Request(url), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.database, false);
});

test("health endpoint rejects methods other than GET", async () => {
  const response = await worker.fetch(new Request(url, { method: "POST" }), {});
  assert.equal(response.status, 405);
  const body = await response.json();
  assert.equal(body.error, "METHOD_NOT_ALLOWED");
});
