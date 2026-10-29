import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../legal/10-matrice-conservation-archivage-purge-rgpd.md', import.meta.url), 'utf8');
const runbook = readFileSync(new URL('../docs/SAUVEGARDE-RESTAURATION-R2-PREPROD.md', import.meta.url), 'utf8');
const privacy = readFileSync(new URL('../legal/04-notice-confidentialite-rgpd.md', import.meta.url), 'utf8');

test('staging config declares daily UTC backup Cron and private R2 binding', () => {
  const config = JSON.parse(wrangler);
  assert.deepEqual(config.triggers.crons, ['0 3 * * *']);
  assert.equal(config.r2_buckets.find(x => x.binding === 'BACKUP_BUCKET')?.bucket_name, 'prochelia-preview-backups');
  assert.equal(config.name, 'prochelia-api-staging');
});

test('backup export excludes its own journal tables to prevent recursive backup growth', () => {
  assert.match(source, /name NOT IN \('backup_runs','backup_objects'\)/);
  assert.match(source, /BACKUP_R2_NOT_CONFIGURED/);
  assert.match(source, /BACKUP_ENCRYPTION_KEY_REQUIRED/);
  assert.match(source, /AES-GCM/);
  assert.match(source, /await backupHash\(enc\)/);
  assert.match(source, /PROCHELIA_BACKUP_MANIFEST_V1/);
  assert.match(source, /async function verifyNationalBackup\(env,runId\)/);
  assert.match(source, /backup_verifications/);
  assert.match(source, /BACKUP_MANIFEST_CHECKSUM_MISMATCH/);
});

test('retention policy forbids indefinite personal-data retention by default and separates backups from archives', () => {
  assert.match(policy, /Pas d'archivage « infini » des données personnelles/);
  assert.match(policy, /sauvegardes/i);
  assert.match(policy, /Archive intermédiaire/);
  assert.match(policy, /suppressions et rectifications/);
  assert.match(privacy, /10-matrice-conservation-archivage-purge-rgpd\.md/);
});

test('restore runbook requires isolated restore, integrity checks and replaying deletion requests', () => {
  assert.match(runbook, /base D1 temporaire isolée/);
  assert.match(runbook, /SHA-256/);
  assert.match(runbook, /registre de suppressions\/rectifications/);
  assert.match(runbook, /ne constitue pas une preuve d'exécution/);
  assert.match(runbook, /outil de déchiffrement\/import contrôlé/);
});
