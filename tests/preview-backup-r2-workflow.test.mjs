import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/backup-preview-d1-to-r2-eu.yml', 'utf8');
const legacyWorkflow = readFileSync('.github/workflows/backup-preview-d1.yml', 'utf8');

test('Preview backup is pinned to the dedicated locked EU R2 bucket', () => {
  assert.match(workflow, /R2_BUCKET:\s*prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /EXPECTED_DB_ID:\s*6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.match(workflow, /EXPECTED_DB_NAME:\s*prochelia-preview-db/);
});

test('Preview backup confirms the exact R2 bucket and EU jurisdiction before D1 export', () => {
  const jurisdiction = workflow.indexOf('Verify private R2 bucket identity and EU jurisdiction before export');
  const exportStep = workflow.indexOf('Export preview D1 (read-only)');
  assert.notEqual(jurisdiction, -1, 'EU jurisdiction gate must exist');
  assert.ok(exportStep > jurisdiction, 'jurisdiction gate must run before export');
  assert.match(workflow, /cf-r2-jurisdiction:\s*eu/);
  assert.match(workflow, /\.result\.jurisdiction\s*==\s*"eu"/);
  assert.match(workflow, /\.result\.name\s*==\s*\$bucket/);
});

test('Preview backup encrypts and verifies R2 round-trip without deploying or restoring remotely', () => {
  assert.match(workflow, /--cipher-algo AES256/);
  assert.match(workflow, /Download backup and verify encryption\/checksum/);
  assert.match(workflow, /cmp .*roundtrip\.sql\.gpg/);
  assert.match(workflow, /Decrypted SQL checksum does not match/);
  assert.doesNotMatch(workflow, /d1 execute .*--remote.*--file/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy(?! --dry-run)/);
});

test('Preview backup provisions EU jurisdiction and uses the jurisdiction-specific S3 endpoint', () => {
  assert.match(workflow, /r2 bucket create "\$R2_BUCKET" --jurisdiction eu --location weur/);
  assert.match(workflow, /f2a79e9fa41566a8ec80fb24c02c60eb\.eu\.r2\.cloudflarestorage\.com/);
});

test('Scheduled Preview backups use the EU R2 workflow, not GitHub artifact storage', () => {
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /github\.event_name == 'schedule'/);
  assert.doesNotMatch(legacyWorkflow, /schedule:/);
});
