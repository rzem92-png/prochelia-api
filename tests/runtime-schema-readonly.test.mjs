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
