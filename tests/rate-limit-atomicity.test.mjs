import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('rate limiting never trusts the client-controlled X-Forwarded-For header', () => {
  const start = source.indexOf('async function productionSubjectHash');
  const end = source.indexOf('async function productionRateLimitSchemaReady', start);
  assert.notEqual(start, -1, 'productionSubjectHash must exist');
  assert.notEqual(end, -1, 'productionSubjectHash must have a clear boundary');
  const implementation = source.slice(start, end);
  assert.match(implementation, /CF-Connecting-IP/);
  assert.match(implementation, /if\(!ip\) return null/);
  assert.doesNotMatch(implementation, /headers\\.get\\(\\s*['\"]X-Forwarded-For['\"]\\s*\\)/i);
});

test('rate-limit increments use one atomic D1 UPSERT with the schema unique key', () => {
  const start = source.indexOf('async function productionRateLimit(');
  const end = source.indexOf('async function strictProductionAudit', start);
  assert.notEqual(start, -1, 'productionRateLimit must exist');
  assert.notEqual(end, -1, 'productionRateLimit must have a clear boundary');
  const implementation = source.slice(start, end);
  assert.match(implementation, /ON CONFLICT\s*\(bucket,subject_hash,window_start\)/);
  assert.match(implementation, /request_count\s*=\s*security_rate_limits\.request_count\s*\+\s*1/);
  assert.match(implementation, /RETURNING request_count/);
  assert.match(implementation, /TRUSTED_CLIENT_IP_UNAVAILABLE/);
  assert.doesNotMatch(implementation, /SELECT request_count FROM security_rate_limits/);
  assert.doesNotMatch(implementation, /UPDATE security_rate_limits SET request_count/);
});
