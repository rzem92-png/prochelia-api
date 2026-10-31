#!/usr/bin/env node
/**
 * PROCHÉLIA preproduction release gate.
 * Read-only static checks: this script never contacts Cloudflare and never writes D1.
 * It deliberately fails closed while runtime schema creation or an incomplete
 * readiness endpoint remains in the Worker.
 */
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const pass = [];
const check = (ok, message) => (ok ? pass : failures).push(message);
const read = (p) => {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { failures.push(`Missing required file: ${p}`); return ''; }
};

const source = read('src/index.js');
const packageJson = JSON.parse(read('package.json') || '{}');
const scripts = packageJson.scripts || {};

check(Boolean(source), 'Worker source is present');
check(Boolean(scripts['test:prelaunch']), 'test:prelaunch script is defined');

const runtimeSchemaCalls = [...source.matchAll(/\bawait\s+(ensure[A-Za-z0-9_]*Schema)\s*\(\s*env\s*\)/g)]
  .map(m => ({ name: m[1], line: source.slice(0, m.index).split('\n').length }));
const uniqueRuntimeCalls = [...new Set(runtimeSchemaCalls.map(x => x.name))];
check(runtimeSchemaCalls.length === 0,
  runtimeSchemaCalls.length
    ? `Runtime DDL calls remain (${runtimeSchemaCalls.length}): ${uniqueRuntimeCalls.join(', ')} at lines ${runtimeSchemaCalls.map(x => x.line).join(', ')}`
    : 'No ensure*Schema(env) calls remain in request-time code');

const readinessStart = source.indexOf("url.pathname === '/api/readiness'");
const infoStart = source.indexOf("url.pathname === '/api/info'", readinessStart);
const readiness = readinessStart >= 0
  ? source.slice(readinessStart, infoStart > readinessStart ? infoStart : readinessStart + 5000)
  : '';
check(Boolean(readiness), 'GET /api/readiness route exists');
const requiredReadinessEvidence = [
  'users', 'sessions', 'missions', 'pricing_policies',
  'payment_transactions', 'payment_webhook_events',
  'identity_verifications', 'security_audit',
  'trust_service_catalog', 'copilot_interactions',
  'backup_runs', 'document_security_scans'
];
const missingReadiness = requiredReadinessEvidence.filter(name => !readiness.includes(name));
check(missingReadiness.length === 0,
  missingReadiness.length
    ? `Readiness endpoint does not verify required module tables: ${missingReadiness.join(', ')}`
    : 'Readiness endpoint references all required module tables');

const migrationDir = 'migrations';
const migrationFiles = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir) : [];
const requiredMigrations = [
  '0001_core_business_schema.sql',
  '0002_server_pricing.sql',
  '0003_route_address_provenance.sql',
  '0004_atomic_wallet_ledger.sql',
  '0005_expert_hardening.sql'
];
const missingMigrations = requiredMigrations.filter(name => !migrationFiles.includes(name));
check(missingMigrations.length === 0,
  missingMigrations.length
    ? `Required ordered migration files missing: ${missingMigrations.join(', ')}`
    : 'Required migration sequence 0001–0005 is present');

const migrationContents = requiredMigrations
  .filter(name => migrationFiles.includes(name))
  .map(name => read(path.join(migrationDir, name)));
const migrationSql = migrationContents.join('\n');
check(migrationContents.length === requiredMigrations.length, 'All required migration files are readable');
if (migrationContents.length === requiredMigrations.length) {
  check(!/\bDROP\s+TABLE\b/i.test(migrationSql), 'No DROP TABLE in release migration set');
  check(!/\bPRAGMA\s+foreign_keys\s*=\s*OFF\b/i.test(migrationSql), 'Foreign-key enforcement is not disabled by migrations');
}

for (const item of pass) console.log(`PASS  ${item}`);
for (const item of failures) console.error(`BLOCK ${item}`);
console.log(`\nPROCHÉLIA RELEASE GATE: ${pass.length} passed / ${failures.length} blocked`);
if (failures.length) process.exitCode = 1;
