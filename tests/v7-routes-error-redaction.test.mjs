import test from 'node:test';
import assert from 'node:assert/strict';
import { handleV7Route } from '../src/v7-routes.js';

test('V7 route errors redact parser and internal exception details', async () => {
  const request = new Request('https://api.example.test/api/v7/check/email', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{malformed-json'
  });
  const response = await handleV7Route(request, {}, '/api/v7/check/email');
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'V7_INTERNAL_ERROR');
  assert.equal(payload.version, '7.0.0');
  assert.doesNotMatch(JSON.stringify(payload), /Unexpected|JSON|SyntaxError|stack/i);
});
