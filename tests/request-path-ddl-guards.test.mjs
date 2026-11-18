import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { productionRateLimit } from "../src/index.js";

function rateLimitEnv({ tables = ["security_rate_limits", "production_security_events"], existingCount = null } = {}) {
  const statements = [];
  const writes = [];
  const env = {
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind(...values) {
            return {
              async first() {
                if (/SELECT request_count FROM security_rate_limits/.test(sql)) {
                  return existingCount === null ? null : { request_count: existingCount };
                }
                throw new Error("Unexpected first(): " + sql);
              },
              async run() {
                writes.push({ sql, values });
                return { meta: { changes: 1 } };
              }
            };
          },
          async all() {
            if (/sqlite_master/.test(sql)) return { results: tables.map(name => ({ name })) };
            throw new Error("Unexpected all(): " + sql);
          }
        };
      }
    }
  };
  return { env, statements, writes };
}

function mutation(path = "/api/complaints") {
  return new Request("https://api.example.test" + path, {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.7" }
  });
}

test("rate limiter checks pre-provisioned tables and performs no request-path DDL", async () => {
  const { env, statements, writes } = rateLimitEnv();
  const result = await productionRateLimit(mutation(), env);
  assert.deepEqual(result, { ok: true });
  assert.ok(statements.some(sql => /sqlite_master/.test(sql)));
  assert.ok(statements.every(sql => !/\b(CREATE|ALTER|DROP)\b/i.test(sql)));
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INSERT INTO security_rate_limits/);
});

test("rate limiter fails closed when pre-provisioned audit tables are missing", async () => {
  const { env, statements, writes } = rateLimitEnv({ tables: ["security_rate_limits"] });
  const result = await productionRateLimit(mutation(), env);
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 503);
  assert.equal((await result.response.json()).error, "RATE_LIMIT_SCHEMA_NOT_READY");
  assert.ok(statements.every(sql => !/\b(CREATE|ALTER|DROP)\b/i.test(sql)));
  assert.equal(writes.length, 0);
});

test("rate-limit block records the audit event without creating its table", async () => {
  const { env, statements, writes } = rateLimitEnv({ existingCount: 20 });
  const result = await productionRateLimit(mutation("/api/payments/test"), env);
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 429);
  assert.equal((await result.response.json()).error, "RATE_LIMITED");
  assert.ok(statements.every(sql => !/\b(CREATE|ALTER|DROP)\b/i.test(sql)));
  assert.equal(writes.length, 2);
  assert.match(writes[0].sql, /UPDATE security_rate_limits/);
  assert.match(writes[1].sql, /INSERT INTO production_security_events/);
});

test("Copilot read model and background job routes do not invoke schema creation helpers", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const copilotStart = source.indexOf("async function copilotNextActions");
  const enqueueStart = source.indexOf("async function enqueueBackgroundJob", copilotStart);
  const processStart = source.indexOf("async function processBackgroundJobs", enqueueStart);
  const processEnd = source.indexOf("function isMutatingMethod", processStart);
  assert.ok(copilotStart >= 0 && enqueueStart > copilotStart && processStart > enqueueStart && processEnd > processStart);
  const copilot = source.slice(copilotStart, enqueueStart);
  const enqueue = source.slice(enqueueStart, processStart);
  const process = source.slice(processStart, processEnd);
  assert.doesNotMatch(copilot, /ensureConsolidatedSchema|ensureOperationalSchema|ensureStrategicSchema|ensureFinalHardeningSchema/);
  assert.doesNotMatch(enqueue, /ensureFinalHardeningSchema/);
  assert.doesNotMatch(process, /ensureFinalHardeningSchema|ensureOperationalSchema|persist:\s*true/);
  assert.match(copilot, /tableExists/);
  assert.match(enqueue, /tableExists/);
  assert.match(process, /tableExists/);
});
