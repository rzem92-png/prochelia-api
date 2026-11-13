import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function productionRateLimit");
const end = source.indexOf("async function strictProductionAudit", start);
assert.ok(start >= 0 && end > start, "productionRateLimit must remain present");
const limiter = source.slice(start, end);

test("security rate-limit counter uses one atomic D1 upsert", () => {
  assert.match(
    limiter,
    /INSERT INTO security_rate_limits[\s\S]*?ON CONFLICT\s*\(bucket,subject_hash,window_start\)[\s\S]*?DO UPDATE SET request_count\s*=\s*security_rate_limits\.request_count\s*\+\s*1[\s\S]*?RETURNING request_count/i
  );
  assert.doesNotMatch(limiter, /SELECT request_count FROM security_rate_limits/i);
  assert.doesNotMatch(limiter, /UPDATE security_rate_limits SET request_count=/i);
});

test("atomic rate-limit upsert is backed by a unique bucket/subject/window key", () => {
  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS security_rate_limits\s*\([\s\S]*?UNIQUE\s*\(bucket,subject_hash,window_start\)/i
  );
});
