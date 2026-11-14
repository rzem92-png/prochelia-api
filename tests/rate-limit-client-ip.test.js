import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("rate-limit identity trusts only the Cloudflare edge client IP header", () => {
  const start = source.indexOf("async function productionSubjectHash");
  const end = source.indexOf("\nasync function productionRateLimit", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /CF-Connecting-IP/);
  assert.match(body, /if\(!ip\) return null/);
  assert.equal(/headers\s*\.\s*get\s*\(\s*["']X-Forwarded-For/i.test(body), false);
});

test("rate-limit handler fails closed when edge identity or D1 schema is unavailable", () => {
  const start = source.indexOf("async function productionRateLimit");
  const end = source.indexOf("\nasync function strictProductionAudit", start);
  assert.ok(start >= 0);
  assert.ok(end > start);
  const body = source.slice(start, end);
  assert.match(body, /RATE_LIMIT_IDENTITY_UNAVAILABLE/);
  assert.match(body, /RATE_LIMIT_SCHEMA_UNAVAILABLE/);
  assert.match(body, /RATE_LIMIT_COUNTER_INVALID/);
  assert.doesNotMatch(body, /ensureFinalHardeningSchema|productionSafetySchema/);
  assert.doesNotMatch(body, /CREATE\s+(TABLE|INDEX)/i);
});

test("rate-limit counter uses one atomic upsert instead of a racy read-modify-write", () => {
  const start = source.indexOf("async function productionRateLimit");
  const end = source.indexOf("\nasync function strictProductionAudit", start);
  const body = source.slice(start, end);
  assert.match(body, /ON CONFLICT\(bucket,subject_hash,window_start\)/);
  assert.match(body, /request_count=security_rate_limits\.request_count\+1/);
  assert.match(body, /RETURNING request_count/);
  assert.doesNotMatch(body, /SELECT request_count FROM security_rate_limits/);
});

test("hardening schema guard is read-only and fails closed on missing objects", () => {
  const start = source.indexOf("async function assertFinalHardeningSchema");
  const end = source.indexOf("\nfunction finalSecretConfigured", start);
  assert.ok(start >= 0);
  assert.ok(end > start);
  const body = source.slice(start, end);
  assert.match(body, /SELECT name FROM sqlite_master/);
  assert.match(body, /FINAL_HARDENING_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE\s+(TABLE|INDEX)/i);
  for (const name of ["system_config_checks","idx_system_config_checks_code","idempotency_records","background_jobs","idx_background_jobs_ready","security_rate_limits","integration_registry"]) {
    assert.ok(body.includes(name), `schema guard must require ${name}`);
  }
});

test("rate-limit audit failure never turns a blocked request into an allowed request", () => {
  const start = source.indexOf("async function productionRateLimit");
  const end = source.indexOf("\nasync function strictProductionAudit", start);
  const body = source.slice(start, end);
  const audit = body.indexOf("INSERT INTO production_security_events");
  const blocked = body.indexOf("error:'RATE_LIMITED'");
  assert.ok(audit >= 0);
  assert.ok(blocked > audit);
  assert.match(body.slice(audit, blocked), /catch/);
});
