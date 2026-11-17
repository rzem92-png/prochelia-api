import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/backup-production-d1-to-r2.yml', 'utf8');
const restoreWorkflow = readFileSync('.github/workflows/restore-production-backup-isolated-test.yml', 'utf8');

test('Production backup is pinned to the production D1 and designated R2 bucket', () => {
  assert.match(workflow, /EXPECTED_DB_ID:\s*04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /R2_BUCKET:\s*prochelia-production-backups-eu-v2/);
  assert.match(workflow, /database\.get\("jurisdiction"\) == "eu"/);
  assert.match(workflow, /refusing backup export/);
});

test('Production backup confirms exact R2 bucket and EU jurisdiction before export', () => {
  const jurisdiction = workflow.indexOf('Verify production backup R2 bucket identity and EU jurisdiction before export');
  const exportStep = workflow.indexOf('Export production D1 read-only and verify dump');
  assert.notEqual(jurisdiction, -1, 'EU jurisdiction gate must exist');
  assert.ok(exportStep > jurisdiction, 'jurisdiction gate must run before export');
  assert.match(workflow, /cf-r2-jurisdiction:\s*eu/);
  assert.match(workflow, /\.result\.jurisdiction\s*==\s*"eu"/);
  assert.match(workflow, /\.result\.name\s*==\s*\$bucket/);
});

test('Production backup is encrypted, integrity checked and round-trip verified', () => {
  assert.match(workflow, /--cipher-algo AES256/);
  assert.match(workflow, /PRAGMA integrity_check/);
  assert.match(workflow, /Download, decrypt and verify R2 backup roundtrip/);
  assert.match(workflow, /R2 backup checksum mismatch/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy(?! --dry-run)/);
});

test('Production backup provisions EU jurisdiction without a conflicting location hint and uses the jurisdiction-specific S3 endpoint', () => {
  assert.match(workflow, /r2 bucket create.*--jurisdiction eu/);
  assert.doesNotMatch(workflow, /--location/);
  assert.match(workflow, /tr -d '\\r\\n'/);
  assert.match(workflow, /f2a79e9fa41566a8ec80fb24c02c60eb\.eu\.r2\.cloudflarestorage\.com/);
});

test('Production backup job is unavailable to unreviewed feature branches', () => {
  assert.ok(workflow.includes("if: ${{ github.ref == 'refs/heads/main' && inputs.confirm_production_backup == 'BACKUP_PRODUCTION_D1' }}"));
  assert.match(workflow, /Production backup must be dispatched from main/);
});

test('Isolated production restore consumes the EU v2 bucket and requires an EU empty target', () => {
  assert.match(restoreWorkflow, /R2_BUCKET:\\s*prochelia-production-backups-eu-v2/);
  assert.match(restoreWorkflow, /f2a79e9fa41566a8ec80fb24c02c60eb\\.eu\\.r2\\.cloudflarestorage\\.com/);
  assert.match(restoreWorkflow, /\\.jurisdiction == "eu"/);
  assert.match(restoreWorkflow, /Isolated restore target is empty/);
  assert.match(restoreWorkflow, /PASS: live production D1 identity and EU jurisdiction verified/);
  assert.doesNotMatch(restoreWorkflow, /R2_BUCKET:\\s*prochelia-production-backups-eu\\s*$/m);
});
