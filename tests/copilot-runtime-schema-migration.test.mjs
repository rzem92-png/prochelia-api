import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../migrations/0006_copilot_schema.sql', import.meta.url), 'utf8');

test('Copilot runtime schema readiness is read-only and fail-closed', () => {
  const start = source.indexOf('async function ensureCopilotSchema(env)');
  const end = source.indexOf('\n}\n', start) + 3;
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const helper = source.slice(start, end);
  assert.match(helper, /sqlite_master/);
  assert.match(helper, /COPILOT_SCHEMA_NOT_READY/);
  assert.doesNotMatch(helper, /CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|INSERT INTO/);
});

test('Copilot migration provisions all tables and indexes used by runtime', () => {
  for (const name of [
    'copilot_interactions',
    'idx_copilot_interactions_user_date',
    'copilot_action_plans',
    'idx_copilot_plans_user_date'
  ]) assert.ok(migration.includes(name), `migration missing ${name}`);
  assert.match(migration, /interaction_id TEXT NOT NULL UNIQUE/);
  assert.match(migration, /approval_required INTEGER NOT NULL DEFAULT 0/);
});
