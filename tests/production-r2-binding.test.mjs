import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

test("Production Worker keeps its pinned production D1 and binds the encrypted backup R2 bucket in EU jurisdiction", () => {
  assert.equal(config.name, "prochelia-api");
  assert.equal(config.d1_databases?.find(x => x.binding === "DB")?.database_id, "04f52830-ef5a-4f17-a640-42bbc2381bba");
  const backup = config.r2_buckets?.find(x => x.binding === "BACKUP_BUCKET");
  assert.deepEqual(backup, {
    binding: "BACKUP_BUCKET",
    bucket_name: "prochelia-production-backups-eu",
    jurisdiction: "eu"
  });
});
