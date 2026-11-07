import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../migrations/0007_trust_passport_schema.sql', import.meta.url), 'utf8');

test('Trust Passport runtime schema helper is read-only and fail-closed', () => {
  const start = source.indexOf('async function ensureTrustPassportSchema');
  const end = source.indexOf('\nasync function trustPassportSaveCatalog', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const helper = source.slice(start, end);
  assert.match(helper, /sqlite_master/);
  assert.match(helper, /TRUST_PASSPORT_SCHEMA_NOT_READY/);
  assert.doesNotMatch(helper, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
});

test('Trust Passport migration provisions required tables and lookup index', () => {
  for (const name of ['trust_service_catalog', 'trust_verifications', 'idx_trust_verifications_lookup']) {
    assert.match(migration, new RegExp(name));
  }
  assert.match(migration, /UNIQUE\(intervenant_id,category,service_code,proof_document_id\)/);
});
