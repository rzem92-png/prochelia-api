import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1.yml", import.meta.url), "utf8");
const restore = await readFile(new URL("../.github/workflows/restore-preview-r2-backup-isolated-test.yml", import.meta.url), "utf8");

test("scheduled Preview D1 backup checks out the exact workflow commit before reading Wrangler config", () => {
  const checkout = workflow.indexOf("Checkout exact workflow commit for pinned Preview D1 config");
  const exportStep = workflow.indexOf("Exporter uniquement la D1 de préproduction");
  assert.ok(checkout >= 0, "checkout step must exist");
  assert.ok(exportStep > checkout, "checkout must precede export");
  const block = workflow.slice(checkout, workflow.indexOf("      - name:", checkout + 1));
  assert.match(block, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(block, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(block, /persist-credentials: false/);
});

test("Preview backup is pinned to the isolated Preview D1 and never deploys or applies migrations", () => {
  assert.match(workflow, /wrangler\.preview-migrations\.jsonc/);
  assert.match(workflow, /prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
});

test("scheduled and manual backup plus restore share the provisioned locked EU bucket and dedicated credentials", () => {
  for (const content of [workflow, restore]) {
    assert.match(content, /prochelia-preview-backups-eu-v2/);
    assert.match(content, /secrets\.R2_EU_ACCESS_KEY_ID/);
    assert.match(content, /secrets\.R2_EU_SECRET_ACCESS_KEY/);
    assert.match(content, /cf-r2-jurisdiction: eu/);
    assert.match(content, /\.result\.jurisdiction == "eu"/);
  }
  assert.match(workflow, /https:\/\/\$CLOUDFLARE_ACCOUNT_ID\.eu\.r2\.cloudflarestorage\.com/);
});

test("scheduled backup verifies the exact R2 EU bucket before exporting Preview D1", () => {
  const r2 = workflow.indexOf("r2_status=");
  const exportStep = workflow.indexOf("Exporter uniquement la D1 de préproduction");
  assert.ok(r2 > 0 && exportStep > r2);
  assert.match(workflow, /r2-bucket-check\.json/);
});

test("only encrypted backup and plaintext checksum manifest are uploaded with restore-compatible object keys", () => {
  const upload = workflow.slice(workflow.indexOf("Déposer l'archive chiffrée dans le bucket R2 EU dédié"), workflow.indexOf("Publier une copie chiffrée de diagnostic"));
  assert.match(upload, /preview-d1\/\$\{DB_NAME\}/);
  assert.match(upload, /\$\{GITHUB_RUN_ID\}-\$\{GITHUB_SHA:0:12\}\.sql\.gpg/);
  assert.match(upload, /manifest\.sha256/);
  assert.match(upload, /\.sql\.gpg/);
  assert.match(upload, /\.sha256/);
  assert.match(upload, /cmp /);
  assert.match(upload, /gpg --batch/);
  assert.match(upload, /PRAGMA integrity_check/);
  assert.match(upload, /PRAGMA foreign_key_check/);
  assert.match(restore, /preview-d1\/prochelia-preview-eu-2026-11-17/);
  assert.doesNotMatch(upload, /prochelia-preview\.sql[" ]/);
});
