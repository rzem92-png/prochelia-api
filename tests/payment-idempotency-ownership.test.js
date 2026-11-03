import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('mission payment idempotency replay requires same parties, mission and amount', () => {
  assert.match(source, /old\.mission_id===missionId && old\.client_id===clientId && old\.intervenant_id===intervenantId/);
  assert.match(source, /Number\(old\.gross_cents\)===gross && Number\(old\.commission_cents\)===commission/);
  assert.match(source, /IDEMPOTENCY_KEY_CONFLICT/);
});

test('payout idempotency replay is bound to authenticated user and exact amount/mode', () => {
  assert.match(source, /old\.user_id!==auth\.user\.id/);
  assert.match(source, /Number\(old\.amount_cents\)===amount && old\.mode===mode/);
  assert.match(source, /Never disclose or replay another user's payout/);
});
