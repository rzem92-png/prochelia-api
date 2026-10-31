import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewText = await readFile(new URL("../wrangler.preview.jsonc", import.meta.url), "utf8");
const productionText = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const preview = JSON.parse(previewText);
const production = JSON.parse(productionText);

test("preview Worker has its own name and the confirmed preview D1 database", () => {
  assert.equal(preview.name, "prochelia-api-preview");
  assert.equal(preview.d1_databases?.length, 1);
  assert.equal(preview.d1_databases[0].binding, "DB");
  assert.equal(preview.d1_databases[0].database_name, "prochelia-preview-db");
  assert.equal(preview.d1_databases[0].database_id, "6adb95e5-e542-4bec-9008-fbea01042305");
});

test("preview D1 is isolated from the production D1 binding", () => {
  const previewId = preview.d1_databases[0].database_id;
  const productionIds = (production.d1_databases || []).map(item => item.database_id);
  assert.ok(previewId);
  assert.ok(!productionIds.includes(previewId), "preview must never bind to production D1");
});

test("preview-only dry-run command is explicitly configured", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["check:worker:preview"], /--dry-run/);
  assert.match(packageJson.scripts["check:worker:preview"], /wrangler\.preview\.jsonc/);
});
