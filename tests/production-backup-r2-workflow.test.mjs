import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/backup-production-d1-to-r2.yml', 'utf8');

test('Production backup is pinned to the production D1 and designated R2 bucket', () => {
  assert.match(workflow, /EXPECTED_DB_ID:\s*04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /R2_BUCKET:\s*prochelia-production-backups-eu-v2/);
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
  assert.doesNotMatch(workflow, /r2 bucket create[^\\n]*--location/);
  assert.match(workflow, /tr -d '\\\\r\\\\n'/);
  assert.match(workflow, /f2a79e9fa41566a8ec80fb24c02c60eb\\\\.eu\\\\.r2\\\\.cloudflarestorage\\\\.com/);
});
