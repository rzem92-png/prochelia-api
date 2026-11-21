import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../migrations-preview-canonical/0033_intervenant_availability_overlap_guard.sql", import.meta.url), "utf8");

test("availability overlap is blocked in the database, not only by the API preflight", () => {
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_disponibilites_no_overlap_insert/);
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_disponibilites_no_overlap_update/);
  assert.match(migration, /existing\.tenant_id = NEW\.tenant_id/);
  assert.match(migration, /existing\.intervenant_id = NEW\.intervenant_id/);
  assert.match(migration, /existing\.start_at < NEW\.end_at/);
  assert.match(migration, /existing\.end_at > NEW\.start_at/);
  assert.match(migration, /RAISE\(ABORT, 'AVAILABILITY_OVERLAP'\)/);
});
