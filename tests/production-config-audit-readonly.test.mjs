import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function productionConfigCheck(env) {');
const end = source.indexOf('\nasync function finalProductionAudit(', start);
assert.ok(start >= 0 && end > start, 'productionConfigCheck source must exist');
const audit = source.slice(start, end);

test('production configuration audit remains strictly read-only', () => {
  assert.match(audit, /mode:'READ_ONLY'/);
  assert.match(audit, /tableExists\(env,t\)/);
  assert.match(audit, /tableColumns\(env,/);
  assert.doesNotMatch(audit, /ensure(?:Consolidated|Payment|Operational|Strategic|FinalHardening)Schema/);
  assert.doesNotMatch(audit, /\.(?:run|batch)\s*\(/);
  assert.doesNotMatch(audit, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i);
});

test('production configuration audit checks required payment and mission fields', () => {
  assert.match(audit, /PAYMENT_COLUMNS/);
  assert.match(audit, /MISSION_CORE_COLUMNS/);
  assert.match(audit, /PAYMENT_WEBHOOK_SECRET/);
  assert.match(audit, /blocking/);
});
