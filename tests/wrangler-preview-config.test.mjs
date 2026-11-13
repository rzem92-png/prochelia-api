import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

test("Preview D1 points only to the dedicated Preview database", () => {
  assert.equal(config.previews.d1_databases.length, 1);
  assert.equal(config.previews.d1_databases[0].binding, "DB");
  assert.equal(config.previews.d1_databases[0].database_name, "prochelia-preview-db");
  assert.equal(config.previews.d1_databases[0].database_id, "6adb95e5-e542-4bec-9008-fbea01042305");
  assert.notEqual(config.previews.d1_databases[0].database_id, "04f52830-ef5a-4f17-a640-42bbc2381bba");
});

test("Preview R2 backup binding points only to the dedicated Preview bucket", () => {
  assert.equal(config.previews.r2_buckets.length, 1);
  assert.deepEqual(config.previews.r2_buckets[0], {
    binding: "BACKUP_BUCKET",
    bucket_name: "prochelia-preview-backups-eu"
  });
  assert.equal(config.r2_buckets, undefined, "No R2 bucket is added to the production top-level config");
});

test("Preview config does not expose secrets as plaintext variables", () => {
  const vars = config.previews.vars || {};
  assert.equal(Object.hasOwn(vars, "BACKUP_ENCRYPTION_KEY"), false);
  assert.equal(Object.hasOwn(vars, "CLOUDFLARE_API_TOKEN"), false);
});
