import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const bucket = "prochelia-preview-backups-eu-v2";

test("Preview R2 provision, backup and isolated restore use one canonical EU bucket", () => {
  const provision = read(".github/workflows/provision-preview-r2-eu.yml");
  const backup = read(".github/workflows/backup-preview-d1-to-r2-eu.yml");
  const restore = read(".github/workflows/restore-preview-r2-backup-isolated-test.yml");
  for (const [name, source] of [["provision", provision], ["backup", backup], ["restore", restore]]) {
    assert.ok(source.includes(bucket), name + " must target the canonical Preview R2 bucket");
    assert.match(source, /jurisdiction eu|jurisdiction: eu|cf-r2-jurisdiction: eu/i,
      name + " must explicitly preserve EU jurisdiction");
  }
  assert.doesNotMatch(provision, /prochelia-preview-backups-eu-locked/);
  assert.doesNotMatch(provision, /r2 bucket create/,
    "verification workflow must not create an unbound parallel bucket");
  assert.match(provision, /VERIFY_PREVIEW_R2_EU_ONLY/);
});
