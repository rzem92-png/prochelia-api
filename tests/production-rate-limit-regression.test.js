import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-level regression guards. These are not a substitute for D1 integration
// tests; they ensure the intended fail-closed and atomic SQL pattern stays present.
const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function productionRateLimit');
const end = source.indexOf('\n}', start);
assert.notEqual(start, -1, 'productionRateLimit must exist');
const limiter = source.slice(start, end + 2);

test('rate limiter fails closed when DB is absent or limiter operation fails', () => {
  assert.match(limiter, /if\(!env\.DB\)/);
  assert.match(limiter, /RATE_LIMIT_UNAVAILABLE/);
});

test('rate limiter uses a single atomic UPSERT rather than read-then-write counters', () => {
  assert.match(limiter, /ON CONFLICT\(bucket,subject_hash,window_start\)/);
  assert.match(limiter, /request_count=security_rate_limits\.request_count\+1/);
  assert.match(limiter, /RETURNING request_count/);
  assert.doesNotMatch(limiter, /SELECT request_count FROM security_rate_limits/);
});

test('rate limit response includes retry guidance and returns 429 on threshold', () => {
  assert.match(limiter, /429/);
  assert.match(limiter, /Retry-After/i);
});

test('limiter derives identity from trusted Cloudflare edge IP, not X-Forwarded-For', () => {
  const subjectStart = source.indexOf('async function productionSubjectHash');
  const subjectEnd = source.indexOf('\n}', subjectStart);
  const subject = source.slice(subjectStart, subjectEnd + 2);
  assert.match(subject, /CF-Connecting-IP/);
  assert.doesNotMatch(subject, /X-Forwarded-For/i);
});
