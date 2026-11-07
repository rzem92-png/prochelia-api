import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

const cases = [
  ['ensureCommercialRecruitmentSchema', 'commercialProspectCreate', '../migrations/0008_commercial_recruitment_schema.sql',
    ['commercial_prospects','idx_commercial_prospects_priority','commercial_playbooks','recruitment_candidates','idx_recruitment_candidates','copilot_growth_actions','sales_results']],
  ['ensureFinanceWorkspaceSchema', 'financeWorkspace', '../migrations/0009_finance_workspace_schema.sql',
    ['finance_workspace_entries','idx_finance_workspace_user','idx_finance_workspace_ref','finance_export_log','idx_finance_export_user','finance_resolution_cases','idx_finance_resolution_user']]
];

for (const [helper, nextFn, migrationPath, required] of cases) {
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
