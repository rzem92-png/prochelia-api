import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('rate limiter checks its schema read-only and fails closed when migration is absent', () => {
  assert.match(source, /async function productionRateLimitSchemaReady\(env\)/);
  assert.match(source, /SELECT 1 AS ready FROM sqlite_master WHERE type='table' AND name='security_rate_limits'/);
  assert.match(source, /RATE_LIMIT_SCHEMA_NOT_READY/);
});

test('rate-limit request path never executes schema DDL', () => {
  const start = source.indexOf('async function productionRateLimit(request,env)');
  const end = source.indexOf('\nasync function strictProductionAudit', start);
  assert.ok(start >= 0 && end > start, 'productionRateLimit function boundaries must exist');
  const limiter = source.slice(start, end);
  assert.doesNotMatch(limiter, /ensure\w+Schema\s*\(/);
  assert.doesNotMatch(limiter, /CREATE TABLE|CREATE INDEX|CREATE TRIGGER/i);
  assert.doesNotMatch(source, /productionSafetySchema\s*\(/);
});

test('rate-limit counter operations occur only after the read-only schema gate', () => {
  const start = source.indexOf('async function productionRateLimit(request,env)');
  const end = source.indexOf('\nasync function strictProductionAudit', start);
  const limiter = source.slice(start, end);
  const gate = limiter.indexOf('productionRateLimitSchemaReady(env)');
  const read = limiter.indexOf('SELECT request_count FROM security_rate_limits');
  const write = limiter.indexOf('INSERT INTO security_rate_limits');
  assert.ok(gate >= 0 && read > gate && write > gate, 'schema gate must precede counter access');
});
