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
  '0004_atomic_wallet_ledger.sql'
];
const fifthMigration = migrationFiles.find(name => /^0005_.+\.sql$/.test(name));
const orderedMigrations = [...requiredMigrations, ...(fifthMigration ? [fifthMigration] : [])];
const missingMigrations = requiredMigrations.filter(name => !migrationFiles.includes(name));
check(missingMigrations.length === 0 && Boolean(fifthMigration),
  missingMigrations.length || !fifthMigration
    ? `Required migration set incomplete. Missing: ${[...missingMigrations, ...(!fifthMigration ? ['a 0005_*.sql migration'] : [])].join(', ')}`
    : `Ordered migration sequence 0001–0005 present (0005: ${fifthMigration})`);

const migrationContents = orderedMigrations.map(name => read(path.join(migrationDir, name)));
const migrationSql = migrationContents.join('\n');
check(migrationContents.length === orderedMigrations.length && migrationContents.every(Boolean), 'All discovered required migration files are readable');
const workerVersion = source.match(/const VERSION = ['\"](V[0-9]+\\.[0-9]+\\.[0-9]+)/)?.[1] || null;
const fifthVersion = fifthMigration ? migrationSql.match(/--\\s*PROCHÉLIA\\s+(V[0-9]+\\.[0-9]+\\.[0-9]+)/)?.[1] || null : null;
check(Boolean(workerVersion && fifthVersion && workerVersion === fifthVersion),
  workerVersion && fifthVersion
    ? `Worker/migration version mismatch: Worker ${workerVersion}, migration 0005 ${fifthVersion}`
    : 'Could not establish Worker and migration 0005 version evidence');
if (migrationContents.length === orderedMigrations.length && migrationContents.every(Boolean)) {
  check(!/\bDROP\s+TABLE\b/i.test(migrationSql), 'No DROP TABLE in release migration set');
  check(!/\bPRAGMA\s+foreign_keys\s*=\s*OFF\b/i.test(migrationSql), 'Foreign-key enforcement is not disabled by migrations');
}

for (const item of pass) console.log(`PASS  ${item}`);
for (const item of failures) console.error(`BLOCK ${item}`);
console.log(`\nPROCHÉLIA RELEASE GATE: ${pass.length} passed / ${failures.length} blocked`);
if (failures.length) process.exitCode = 1;
