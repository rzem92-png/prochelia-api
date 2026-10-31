import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('runtime DDL helper inventory stays explicit until versioned migrations replace it', () => {
  const definitions = [...source.matchAll(/async function (ensure\w+Schema)\(env\)/g)].map(x => x[1]).sort();
  assert.deepEqual(definitions, [
    'ensureCommercialRecruitmentSchema',
    'ensureConsolidatedSchema',
    'ensureFinalHardeningSchema',
    'ensureFinanceWorkspaceSchema',
    'ensureNationalContinuitySchema',
    'ensureOperationalSchema',
    'ensurePaymentSchema',
    'ensureProcheliaMasterComplementSchema',
    'ensureSecuritySchema',
    'ensureStrategicSchema'
  ]);
});

test('rate limiting has an explicit read-only schema dependency and no runtime DDL', () => {
  const start = source.indexOf('async function productionRateLimit(request,env)');
  const end = source.indexOf('async function strictProductionAudit', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const route = source.slice(start, end);
  assert.match(route, /productionRateLimitSchemaReady\(env\)/);
  assert.match(source, /SELECT 1 AS ready FROM sqlite_master WHERE type='table' AND name='security_rate_limits'/);
  assert.match(route, /RATE_LIMIT_SCHEMA_NOT_READY/);
  assert.doesNotMatch(route, /ensure\w+Schema\s*\(/);
  assert.doesNotMatch(route, /CREATE TABLE|CREATE INDEX|CREATE TRIGGER/i);
  assert.doesNotMatch(source, /productionSafetySchema\s*\(/);
});
test('the catalogue still has two distinct read paths and cannot be consolidated without a migration', () => {
  assert.match(source, /SELECT \* FROM prestations ORDER BY id/);
  assert.match(source, /SELECT \* FROM métier_catalog WHERE active=1/);
  assert.match(source, /FROM métier_catalog WHERE code=\? AND active=1/);
});
