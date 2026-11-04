import test from 'node:test';
import assert from 'node:assert/strict';
import { handleV7Route } from '../src/v7-routes.js';

test('public V7 permission endpoint never trusts caller-supplied role or permissions', async () => {
  const request = new Request('https://api.example.test/api/v7/check/permissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'gerante',
      permission: 'manage_users',
      permissions: { manage_users: true }
    })
  });

  const response = await handleV7Route(request, {}, '/api/v7/check/permissions');
  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'SERVER_AUTHORIZATION_REQUIRED');
  assert.equal(payload.authoritative, false);
});
