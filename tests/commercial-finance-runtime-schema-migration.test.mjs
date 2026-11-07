import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

const cases = [
  ['ensureCommercialRecruitmentSchema', '../migrations/0008_commercial_recruitment_schema.sql',
    ['commercial_prospects','idx_commercial_prospects_priority','commercial_playbooks','recruitment_candidates','idx_recruitment_candidates','copilot_growth_actions','sales_results']],
  ['ensureFinanceWorkspaceSchema', '../migrations/0009_finance_workspace_schema.sql',
    ['finance_workspace_entries','idx_finance_workspace_user','idx_finance_workspace_ref','finance_export_log','idx_finance_export_user','finance_resolution_cases','idx_finance_resolution_user']]
];

for (const [helper, migrationPath, required] of cases) {
  test(helper + ' is read-only and fail-closed', async () => {
    const start = source.indexOf('async function ' + helper);
    const end = source.indexOf('\nasync function ' + nextFn, start);
    assert.notEqual(start, -1, 'helper found');
    assert.notEqual(end, -1, 'helper boundary found');
    const body = source.slice(start, end);
    assert.match(body, /sqlite_master/);
    assert.match(body, /SCHEMA_NOT_READY/);
    assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
    const migration = await readFile(new URL(migrationPath, import.meta.url), 'utf8');
    for (const name of required) assert.ok(migration.includes(name), 'migration includes ' + name);
  });
}

test('ensureStrategicSchema is read-only and fail-closed', async () => {
  const helper = 'ensureStrategicSchema';
  const start = source.indexOf('async function ' + helper);
  assert.notEqual(start, -1, 'helper found');
  const nextFunction = source.indexOf('\nfunction promotionCandidate', start);
  assert.notEqual(nextFunction, -1, 'helper boundary found');
  const body = source.slice(start, nextFunction);
  assert.match(body, /sqlite_master/);
  assert.match(body, /STRATEGIC_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0010_strategic_schema.sql', import.meta.url), 'utf8');
  for (const name of ['promotions','idx_promotions_active','promotion_recommendations','idx_promotion_reco_status','commercial_events','market_signals','client_value_scores','strategic_alerts']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('ensureFinalHardeningSchema is read-only and fail-closed', async () => {
  const start = source.indexOf('async function ensureFinalHardeningSchema');
  const end = source.indexOf('\nfunction finalSecretConfigured', start);
  assert.notEqual(start, -1, 'helper found');
  assert.notEqual(end, -1, 'helper boundary found');
  const body = source.slice(start, end);
  assert.match(body, /sqlite_master/);
  assert.match(body, /FINAL_HARDENING_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0011_final_hardening_schema.sql', import.meta.url), 'utf8');
  for (const name of ['system_config_checks','idempotency_records','background_jobs','security_rate_limits','integration_registry']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('ensureNationalContinuitySchema is read-only and migration seeds defaults', async () => {
  const start = source.indexOf('async function ensureNationalContinuitySchema');
  const end = source.indexOf('\nfunction b64', start);
  assert.notEqual(start, -1, 'helper found');
  assert.notEqual(end, -1, 'helper boundary found');
  const body = source.slice(start, end);
  assert.match(body, /sqlite_master/);
  assert.match(body, /NATIONAL_CONTINUITY_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0012_national_continuity_schema.sql', import.meta.url), 'utf8');
  for (const name of ['platform_scale_config','backup_runs','backup_objects','maxPageSize','defaultPageSize','importBatchSize','backupRetentionDays']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('ensureProcheliaMasterComplementSchema is read-only for DDL and preserves explicit seed initialization', async () => {
  const start = source.indexOf('async function ensureProcheliaMasterComplementSchema');
  const end = source.indexOf('\nfunction supportRoleAllowed', start);
  assert.notEqual(start, -1, 'helper found');
  assert.notEqual(end, -1, 'helper boundary found');
  const body = source.slice(start, end);
  assert.match(body, /sqlite_master/);
  assert.match(body, /MASTER_COMPLEMENT_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE/i);
  assert.match(body, /INSERT OR IGNORE INTO brand_identity/);
  assert.match(body, /INSERT OR IGNORE INTO interface_profiles/);
  assert.match(body, /INSERT OR IGNORE INTO copilot_resolution_rules/);
  const migration = await readFile(new URL('../migrations/0013_master_complement_schema.sql', import.meta.url), 'utf8');
  for (const name of ['brand_identity','brand_assets','brand_clearance_log','interface_profiles','support_cases','support_case_events','copilot_resolution_rules']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('ensureOperationalSchema has no runtime DDL/ALTER and checks columns', async () => {
  const start = source.indexOf('async function ensureOperationalSchema');
  const end = source.indexOf('\nasync function ', start + 15);
  assert.notEqual(start, -1, 'helper found');
  assert.notEqual(end, -1, 'helper boundary found');
  const body = source.slice(start, end);
  assert.match(body, /sqlite_master/);
  assert.match(body, /PRAGMA table_info\(action_outbox\)/);
  assert.match(body, /OPERATIONAL_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0014_operational_schema.sql', import.meta.url), 'utf8');
  for (const name of ['action_outbox','processed_at','case_id','copilot_briefings','loyalty_events','loyalty_balances','quality_events','b2b_leads','capacity_snapshots','finance_forecasts','system_checks']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});
