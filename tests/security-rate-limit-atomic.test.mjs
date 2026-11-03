import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const subjectStart = source.indexOf('async function productionSubjectHash');
const limiterStart = source.indexOf('async function productionRateLimit');
const limiterEnd = source.indexOf('\nasync function ', limiterStart + 10);
assert.notEqual(subjectStart, -1, 'productionSubjectHash must exist');
assert.notEqual(limiterStart, -1, 'productionRateLimit must exist');
assert.notEqual(limiterEnd, -1, 'productionRateLimit must have a following function');
const subjectHash = source.slice(subjectStart, limiterStart);
const limiter = source.slice(limiterStart, limiterEnd);

test('rate-limit identity uses Cloudflare edge IP and never trusts X-Forwarded-For', () => {
  assert.match(subjectHash, /CF-Connecting-IP/);
  assert.doesNotMatch(subjectHash, /X-Forwarded-For/i);
});

test('counter uses atomic D1 UPSERT with RETURNING instead of read-modify-write', () => {
  assert.match(limiter, /ON CONFLICT\(bucket,subject_hash,window_start\)/);
  assert.match(limiter, /request_count=security_rate_limits\.request_count\+1/);
  assert.match(limiter, /RETURNING request_count/);
  assert.doesNotMatch(limiter, /SELECT request_count FROM security_rate_limits/);
  assert.doesNotMatch(limiter, /UPDATE security_rate_limits SET request_count/);
});

test('missing D1 or limiter storage error fails closed with 503', () => {
  assert.match(limiter, /if\(!env\?\.DB\)/);
  assert.match(limiter, /RATE_LIMIT_UNAVAILABLE/);
  assert.match(limiter, /catch\s*\{[^}]*RATE_LIMIT_UNAVAILABLE/s);
});

test('rate threshold produces 429 and Retry-After', () => {
  assert.match(limiter, /count>limit/);
  assert.match(limiter, /RATE_LIMITED/);
  assert.match(limiter, /'retry-after':String\(retryAfter\)/);
});

test('audit log failure cannot turn a blocked request into an allowed request', () => {
  const block = limiter.slice(limiter.indexOf('if(count>limit)'), limiter.indexOf('return {ok:true};', limiter.indexOf('if(count>limit)')));
  assert.match(block, /catch\s*\{[^}]*keep the block/s);
  assert.match(block, /return \{ok:false,response:json\(\{ok:false,error:'RATE_LIMITED'/);
});
