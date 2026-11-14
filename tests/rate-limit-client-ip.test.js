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
  assert.equal(/headers\s*\.\s*get\s*\(\s*["']X-Forwarded-For/i.test(body), false);
});

test("rate-limit counter uses one atomic upsert instead of a racy read-modify-write", () => {
  const start = source.indexOf("async function productionRateLimit");
  const end = source.indexOf("\nasync function strictProductionAudit", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /ON CONFLICT\(bucket,subject_hash,window_start\)/);
  assert.match(body, /request_count=security_rate_limits\.request_count\+1/);
  assert.match(body, /RETURNING request_count/);
  assert.doesNotMatch(body, /SELECT request_count FROM security_rate_limits/);
});
