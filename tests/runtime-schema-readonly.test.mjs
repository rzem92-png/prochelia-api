import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const helpers = [
  'ensureConsolidatedSchema',
  'ensureStrategicSchema',
  'ensureOperationalSchema',
  'ensureFinalHardeningSchema',
  'ensureCommercialRecruitmentSchema',
  'ensureProcheliaMasterComplementSchema'
];

test('runtime schema helpers are migration-first and read-only', () => {
  assert.match(source, /async function assertVersionedSchema\([\s\S]*?PRAGMA table_info/);
  assert.match(source, /error\.status = 503/);
  for (const name of helpers) {
    const start = source.indexOf('async function ' + name);
    assert.notEqual(start, -1, name + ' exists');
    const next = source.slice(start).search(/\n(?:async )?function /);
    const body = source.slice(start, next > 0 ? start + next : undefined);
    assert.match(body, /assertVersionedSchema\(/, name + ' checks versioned schema');
    assert.doesNotMatch(body, /\b(?:CREATE\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|ALTER\s+TABLE)\b[^\n]*?\.run\s*\(/i, name + ' does not execute DDL');
    assert.doesNotMatch(body, /prepare\(\s*`\s*(?:CREATE|ALTER)\b/i, name + ' does not prepare runtime DDL');
  }
});


test('master brand, interface and Copilot defaults are versioned instead of written at request time', () => {
  const start = source.indexOf('async function ensureProcheliaMasterComplementSchema');
  const next = source.slice(start).search(/\n(?:async )?function /);
  const body = source.slice(start, next > 0 ? start + next : undefined);
  assert.doesNotMatch(body, /\b(?:INSERT|UPDATE|DELETE)\s+(?:OR\s+IGNORE\s+)?(?:INTO\s+)?(?:brand_identity|interface_profiles|copilot_resolution_rules)\b/i);
  const migration = readFileSync(new URL('../migrations-preview-canonical/0045_master_complement_seed_data.sql', import.meta.url), 'utf8');
  for (const table of ['brand_identity', 'interface_profiles', 'copilot_resolution_rules']) {
    assert.match(migration, new RegExp('INSERT OR IGNORE INTO ' + table, 'i'));
  }
  assert.match(migration, /seed-interface-client-v1/);
  assert.match(migration, /seed-interface-intervenant-v1/);
  assert.match(migration, /seed-rule-identity_security-v1/);
  assert.match(migration, /seed-rule-legal_dispute-v1/);
});
