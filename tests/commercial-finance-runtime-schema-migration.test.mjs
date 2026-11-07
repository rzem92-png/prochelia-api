import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function helperBody(name) {
  const start = source.indexOf('async function ' + name);
  assert.notEqual(start, -1, name + ' helper found');
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, name + ' opening brace found');
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(name + ' closing brace found');
}

const cases = [
  ['ensureCommercialRecruitmentSchema', '../migrations/0008_commercial_recruitment_schema.sql',
    ['commercial_prospects','idx_commercial_prospects_priority','commercial_playbooks','recruitment_candidates','idx_recruitment_candidates','copilot_growth_actions','sales_results']],
  ['ensureFinanceWorkspaceSchema', '../migrations/0009_finance_workspace_schema.sql',
    ['finance_workspace_entries','idx_finance_workspace_user','idx_finance_workspace_ref','finance_export_log','idx_finance_export_user','finance_resolution_cases','idx_finance_resolution_user']]
];

for (const [helper, migrationPath, required] of cases) {
  test(helper + ' is read-only and fail-closed', async () => {
    const body = helperBody(helper);
    assert.match(body, /sqlite_master/);
    assert.match(body, /SCHEMA_NOT_READY/);
    assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
    const migration = await readFile(new URL(migrationPath, import.meta.url), 'utf8');
    for (const name of required) assert.ok(migration.includes(name), 'migration includes ' + name);
  });
}

test('ensureStrategicSchema is read-only and fail-closed', async () => {
  const helper = 'ensureStrategicSchema';
  const body = helperBody(helper);
  assert.match(body, /sqlite_master/);
  assert.match(body, /STRATEGIC_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0010_strategic_schema.sql', import.meta.url), 'utf8');
  for (const name of ['promotions','idx_promotions_active','promotion_recommendations','idx_promotion_reco_status','commercial_events','market_signals','client_value_scores','strategic_alerts']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('ensureFinalHardeningSchema is read-only and fail-closed', async () => {
  const body = helperBody('ensureFinalHardeningSchema');
  assert.match(body, /sqlite_master/);
  assert.match(body, /FINAL_HARDENING_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0011_final_hardening_schema.sql', import.meta.url), 'utf8');
  for (const name of ['system_config_checks','idempotency_records','background_jobs','security_rate_limits','integration_registry']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('ensureNationalContinuitySchema is read-only and migration seeds defaults', async () => {
  const body = helperBody('ensureNationalContinuitySchema');
  assert.match(body, /sqlite_master/);
  assert.match(body, /NATIONAL_CONTINUITY_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0012_national_continuity_schema.sql', import.meta.url), 'utf8');
  for (const name of ['platform_scale_config','backup_runs','backup_objects','maxPageSize','defaultPageSize','importBatchSize','backupRetentionDays']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('ensureProcheliaMasterComplementSchema is read-only for DDL and preserves explicit seed initialization', async () => {
  const body = helperBody('ensureProcheliaMasterComplementSchema');
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
  const body = helperBody('ensureOperationalSchema');
  assert.match(body, /sqlite_master/);
  assert.match(body, /PRAGMA table_info\(action_outbox\)/);
  assert.match(body, /OPERATIONAL_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0014_operational_schema.sql', import.meta.url), 'utf8');
  for (const name of ['action_outbox','processed_at','case_id','copilot_briefings','loyalty_events','loyalty_balances','quality_events','b2b_leads','capacity_snapshots','finance_forecasts','system_checks']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
});

test('productionSafetySchema is read-only and fail-closed', async () => {
  const body = helperBody('productionSafetySchema');
  assert.match(body, /sqlite_master/);
  assert.match(body, /PRODUCTION_SAFETY_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0015_production_security_events.sql', import.meta.url), 'utf8');
  assert.match(migration, /production_security_events/);
  assert.match(migration, /idx_prod_sec_events_date/);
});

test('ensureSecuritySchema is read-only and fail-closed', async () => {
  const body = helperBody('ensureSecuritySchema');
  assert.match(body, /sqlite_master/);
  assert.match(body, /SECURITY_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0016_security_identity_schema.sql', import.meta.url), 'utf8');
  for (const name of ['identity_verifications','trusted_devices','mission_security','mission_security_attempts','security_audit']) assert.ok(migration.includes(name));
});

test('ensureDocumentSecuritySchema is read-only and fail-closed', async () => {
  const body = helperBody('ensureDocumentSecuritySchema');
  assert.match(body, /sqlite_master/);
  assert.match(body, /DOCUMENT_SECURITY_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0017_document_security_scans.sql', import.meta.url), 'utf8');
  assert.match(migration, /document_security_scans/);
  assert.match(migration, /idx_document_scans_latest/);
});

test('ensureConsolidatedSchema is read-only and consolidated migration carries seeds', async () => {
  const body = helperBody('ensureConsolidatedSchema');
  assert.match(body, /sqlite_master/);
  assert.match(body, /CONSOLIDATED_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/i);
  const migration = await readFile(new URL('../migrations/0018_consolidated_business_schema.sql', import.meta.url), 'utf8');
  for (const name of ['platform_settings','pricing_policies','pricing_travel_policies','pricing_route_estimates','pricing_route_estimate_audit','pricing_holidays','operational_cases','case_actions','activity_journal','accounting_ledger','compliance_events']) {
    assert.ok(migration.includes(name), 'migration includes ' + name);
  }
  assert.match(migration, /idx_pricing_route_owner_expiry[\s\S]*?pricing_route_estimate_audit/);
  assert.match(migration, /project_phase/);
  assert.match(migration, /2030-12-25/);
});

test('backup verification handler does not create schema at runtime', async () => {
  const body = helperBody('verifyNationalBackup');
  assert.doesNotMatch(body, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE/i);
  assert.match(body, /backup_verifications/);
  assert.match(body, /NATIONAL_CONTINUITY_SCHEMA_NOT_READY/);
  const migration = await readFile(new URL('../migrations/0019_backup_verifications.sql', import.meta.url), 'utf8');
  assert.match(migration, /backup_verifications/);
});
