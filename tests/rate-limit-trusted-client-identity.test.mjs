import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('rate limiter derives identity only from trusted Cloudflare header', () => {
  const start = source.indexOf('async function productionSubjectHash');
  const end = source.indexOf('async function hashPassword', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const helper = source.slice(start, end);
  const executable = helper.split(/\\r?\\n/).filter(line => !line.trim().startsWith('//')).join('\\n');

  assert.match(executable, /CF-Connecting-IP/);
  assert.match(executable, /if\\s*\\(!ip\\)\\s*return null/);
  assert.match(executable, /sha256Hex/);
  assert.doesNotMatch(executable, /X-Forwarded-For/);
});

test('rate limiter rejects missing trusted client identity before D1 increment', () => {
  const start = source.indexOf('async function productionRateLimit(request,env)');
  const end = source.indexOf('async function strictProductionAudit', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const limiter = source.slice(start, end);

  const identityGuard = limiter.indexOf('RATE_LIMIT_CLIENT_ID_UNAVAILABLE');
  const schemaCheck = limiter.indexOf('productionRateLimitSchemaReady(env)');
  const counterWrite = limiter.indexOf('INSERT INTO security_rate_limits');
  assert.notEqual(identityGuard, -1);
  assert.ok(schemaCheck > identityGuard);
  assert.ok(counterWrite > identityGuard);
});
