import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceAtomicRateLimit } from '../src/security-rate-limit-atomic-v1.js';

class FakeD1 {
  constructor() { this.rows = new Map(); this.fail = false; }
  prepare(sql) {
    const self = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (self.fail) throw new Error('simulated D1 outage');
            assert.match(sql, /INSERT INTO security_rate_limits_v2/);
            const [bucket, subject, windowStart, _expiresAt, limit] = args;
            const key = [bucket, subject, windowStart].join('|');
            const count = Math.min((self.rows.get(key) ?? 0) + 1, limit + 1);
            self.rows.set(key, count);
            return { request_count: count };
          }
        };
      }
    };
  }
}

const req = (ip = '203.0.113.10', extra = {}) => new Request('https://example.test/api/auth/login', {
  headers: { 'CF-Connecting-IP': ip, ...extra }
});

test('allows requests within limit and blocks the next request', async () => {
  const db = new FakeD1();
  const options = { db, request: req(), bucket: 'auth-login', limit: 2, nowSeconds: 120 };
  assert.equal((await enforceAtomicRateLimit(options)).ok, true);
  assert.equal((await enforceAtomicRateLimit(options)).ok, true);
  const blocked = await enforceAtomicRateLimit(options);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.response.headers.get('retry-after'), '60');
});

test('uses trusted CF-Connecting-IP, not spoofable X-Forwarded-For', async () => {
  const db = new FakeD1();
  const options = { db, bucket: 'test', limit: 10, nowSeconds: 100 };
  await enforceAtomicRateLimit({ ...options, request: req('198.51.100.1', { 'X-Forwarded-For': '1.1.1.1' }) });
  await enforceAtomicRateLimit({ ...options, request: req('198.51.100.1', { 'X-Forwarded-For': '2.2.2.2' }) });
  assert.equal(db.rows.size, 1);
  await enforceAtomicRateLimit({ ...options, request: req('198.51.100.2', { 'X-Forwarded-For': '1.1.1.1' }) });
  assert.equal(db.rows.size, 2);
});

test('isolates buckets and time windows', async () => {
  const db = new FakeD1();
  const base = { db, request: req(), limit: 5, windowSeconds: 60, nowSeconds: 120 };
  await enforceAtomicRateLimit({ ...base, bucket: 'bucket-a' });
  await enforceAtomicRateLimit({ ...base, bucket: 'bucket-b' });
  await enforceAtomicRateLimit({ ...base, bucket: 'bucket-a', nowSeconds: 180 });
  assert.equal(db.rows.size, 3);
});

test('fails closed if D1 is absent or throws', async () => {
  const missing = await enforceAtomicRateLimit({ request: req(), bucket: 'sensitive', limit: 1 });
  assert.equal(missing.ok, false);
  assert.equal(missing.response.status, 503);
  const db = new FakeD1();
  db.fail = true;
  const failed = await enforceAtomicRateLimit({ db, request: req(), bucket: 'sensitive', limit: 1 });
  assert.equal(failed.ok, false);
  assert.equal(failed.response.status, 503);
});

test('rejects invalid rate-limit configuration', async () => {
  const result = await enforceAtomicRateLimit({ db: new FakeD1(), request: req(), bucket: '', limit: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 503);
});

test('concurrent increments are not lost in the simulated atomic D1 primitive', async () => {
  const db = new FakeD1();
  const options = { db, request: req(), bucket: 'parallel', limit: 1000, nowSeconds: 300 };
  const results = await Promise.all(Array.from({ length: 100 }, () => enforceAtomicRateLimit(options)));
  assert.equal(results.filter(x => x.ok).length, 100);
  assert.equal([...db.rows.values()][0], 100);
});


test('fails closed when trusted Cloudflare client IP is missing', async () => {
  const db = new FakeD1();
  const request = new Request('https://example.test/api/auth/login');
  const result = await enforceAtomicRateLimit({ db, request, bucket: 'login', limit: 5, nowSeconds: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 503);
  assert.equal((await result.response.json()).error, 'RATE_LIMIT_CLIENT_ID_UNAVAILABLE');
  assert.equal(db.rows.size, 0);
});


test('rejects oversized bucket and malformed identity configuration', async () => {
  const db = new FakeD1();
  const base = { db, request: req(), limit: 3, nowSeconds: 100 };
  const cases = [
    { bucket: 'x'.repeat(129) },
    { bucket: 'login', userId: 123 },
    { bucket: 'login', sessionHash: '' },
    { bucket: 'login', nowSeconds: Number.MAX_SAFE_INTEGER + 1 },
    { bucket: 'login', windowSeconds: 86401 },
    { bucket: 'login', limit: 1000001 }
  ];
  for (const overrides of cases) {
    const result = await enforceAtomicRateLimit({ ...base, bucket: 'login', ...overrides });
    assert.equal(result.ok, false);
    assert.equal(result.response.status, 503);
    assert.equal((await result.response.json()).error, 'RATE_LIMIT_CONFIG_INVALID');
  }
  assert.equal(db.rows.size, 0);
});


test('rate limit identity combines IP and user subject', async () => {
 const db = new FakeD1();
 const base = { db, bucket: 'account-action', limit: 20, nowSeconds: 400 };
 await enforceAtomicRateLimit({ ...base, request: req('203.0.113.10'), userId: 'user-a' });
 await enforceAtomicRateLimit({ ...base, request: req('203.0.113.11'), userId: 'user-a' });
 await enforceAtomicRateLimit({ ...base, request: req('203.0.113.10'), userId: 'user-b' });
 assert.equal(db.rows.size, 3);
});


test('counter stops growing after limit+1 during sustained abusive traffic', async () => {
 const db = new FakeD1();
 const options = { db, request: req(), bucket: 'abuse', limit: 2, nowSeconds: 500 };
 const results = await Promise.all(Array.from({ length: 100 }, () => enforceAtomicRateLimit(options)));
 assert.equal(results.filter(r => r.ok).length, 2);
 assert.equal([...db.rows.values()][0], 3, 'counter should remain capped at limit+1');
});
