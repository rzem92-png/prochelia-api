import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1.yml", import.meta.url), "utf8");

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

test("Preview D1 backup is pinned to the isolated Preview database and never deploys or applies migrations", () => {
  assert.match(workflow, /wrangler\.preview-migrations\.jsonc/);
  assert.match(workflow, /prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
});

test("R2 backup requires dedicated credentials and uses the EU jurisdiction endpoint", () => {
  assert.match(workflow, /secrets\.R2_ACCESS_KEY_ID/);
  assert.match(workflow, /secrets\.R2_SECRET_ACCESS_KEY/);
  assert.match(workflow, /https:\/\/\$CLOUDFLARE_ACCOUNT_ID\.eu\.r2\.cloudflarestorage\.com/);
  assert.match(workflow, /prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /aws s3api head-bucket/);
  assert.match(workflow, /aws s3api put-object/);
});

test("only encrypted backup objects are uploaded and round-trip integrity is verified", () => {
  const upload = workflow.slice(workflow.indexOf("Déposer l'archive chiffrée dans R2 EU"), workflow.indexOf("Publier une copie chiffrée de diagnostic"));
  assert.match(upload, /prochelia-preview\.sql\.gpg/);
  assert.match(upload, /Metadata\.sha256/);
  assert.match(upload, /aws s3api get-object/);
  assert.match(upload, /downloaded_checksum.*checksum/s);
  assert.doesNotMatch(upload, /prochelia-preview\.sql[" ]/);
});
