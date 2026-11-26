import test from 'node:test';
import assert from 'node:assert/strict';
import { handleV7Route } from '../src/v7-routes.js';

test('public market registry lists configured markets without enabling any launch', async () => {
  const response = await handleV7Route(new Request('https://api.example/api/v7/markets'), {}, '/api/v7/markets');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.count, 14);
  assert.equal(body.markets.length, 14);
  assert.ok(body.markets.some(m => m.countryCode === 'DZ' && m.languages.includes('ar')));
  assert.ok(body.markets.some(m => m.countryCode === 'FR' && m.currency === 'EUR'));
  assert.ok(body.markets.every(m => m.marketStatus === 'evaluation' && m.launchEnabled === false));
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300, stale-while-revalidate=60');
});

test('market registry rejects non-GET methods', async () => {
  const response = await handleV7Route(new Request('https://api.example/api/v7/markets', { method: 'POST' }), {}, '/api/v7/markets');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.deepEqual(await response.json(), { ok: false, error: 'METHOD_NOT_ALLOWED', allowed: ['GET'] });
});

test('unknown v7 paths remain unhandled', async () => {
  const response = await handleV7Route(new Request('https://api.example/api/v7/not-a-route'), {}, '/api/v7/not-a-route');
  assert.equal(response, null);
});
