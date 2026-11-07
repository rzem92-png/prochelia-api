import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('configuration audits cannot authorize real production traffic', () => {
  assert.match(source, /production_gate:'CLOSED_RELEASE_VALIDATION_REQUIRED'/);
  assert.match(source, /ready_for_real_traffic:false/);
  assert.match(source, /required_release_evidence:\['STAGING_D1_MIGRATIONS','STAGING_RUNTIME_ACCEPTANCE','STRIPE_SANDBOX_E2E','BACKUP_RESTORE_VERIFIED','SECURITY_REVIEW','RGPD_LEGAL_REVIEW','HUMAN_PRODUCTION_APPROVAL'\]/);
});

test('release gate explicitly includes sandbox, verified restore and human approval', () => {
  for (const evidence of [
    'STRIPE_SANDBOX_E2E',
    'BACKUP_RESTORE_VERIFIED',
    'SECURITY_REVIEW',
    'RGPD_LEGAL_REVIEW',
    'HUMAN_PRODUCTION_APPROVAL'
  ]) assert.ok(source.includes(evidence), `Missing release evidence gate: ${evidence}`);
});

test('no configuration audit returns ready_for_real_traffic from a boolean config result', () => {
  assert.doesNotMatch(source, /ready_for_real_traffic:(?:result|overall)\.overall|ready_for_real_traffic:overall/);
});
