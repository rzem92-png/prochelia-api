import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations-preview-canonical/0034_timezone_safe_availability_overlap.sql", import.meta.url), "utf8");
const validationMigration = await readFile(new URL("../migrations-preview-canonical/0035_validate_availability_intervals.sql", import.meta.url), "utf8");
const idempotencyMigration = await readFile(new URL("../migrations-preview-canonical/0036_intervenant_availability_idempotency.sql", import.meta.url), "utf8");

const start = worker.indexOf("async function intervenantAvailabilityRoute(");
const end = worker.indexOf("\nasync function intervenantOpportunityRoute(", start);
assert.ok(start >= 0 && end > start, "canonical availability route must exist");
const route = worker.slice(start, end);

test("availability inputs are normalized to canonical UTC before persistence", () => {
  assert.match(route, /Date\.parse\(startAt\)/);
  assert.match(route, /Date\.parse\(endAt\)/);
  assert.match(route, /new Date\(startMs\)\.toISOString\(\)/);
  assert.match(route, /new Date\(endMs\)\.toISOString\(\)/);
  assert.match(route, /canonicalStartAt/);
  assert.match(route, /canonicalEndAt/);
});

test("API overlap and duplicate checks compare actual instants across UTC offsets", () => {
  assert.match(route, /julianday\(start_at\) = julianday\(\?\)/);
  assert.match(route, /julianday\(end_at\) = julianday\(\?\)/);
  assert.match(route, /julianday\(start_at\) < julianday\(\?\)/);
  assert.match(route, /julianday\(end_at\) > julianday\(\?\)/);
  assert.doesNotMatch(route, /start_at < \? AND end_at > \?/);
});

test("database INSERT and UPDATE triggers use timezone-aware instant comparisons", () => {
  assert.match(migration, /DROP TRIGGER IF EXISTS trg_disponibilites_no_overlap_insert/);
  assert.match(migration, /CREATE TRIGGER trg_disponibilites_no_overlap_insert/);
  assert.match(migration, /CREATE TRIGGER trg_disponibilites_no_overlap_update/);
  assert.equal((migration.match(/julianday\(existing\.start_at\) < julianday\(NEW\.end_at\)/g) || []).length, 2);
  assert.equal((migration.match(/julianday\(existing\.end_at\) > julianday\(NEW\.start_at\)/g) || []).length, 2);
  assert.equal((migration.match(/RAISE\(ABORT, 'AVAILABILITY_OVERLAP'\)/g) || []).length, 2);
});

test("availability remains tenant- and intervenant-scoped in database triggers", () => {
  assert.equal((migration.match(/existing\.tenant_id = NEW\.tenant_id/g) || []).length, 2);
  assert.equal((migration.match(/existing\.intervenant_id = NEW\.intervenant_id/g) || []).length, 2);
});

test("database-enforced overlap conflicts remain explicit to the intervenant API", () => {
  assert.match(route, /catch \(error\)/);
  assert.match(route, /String\(error\?\.message \|\| error\)\.includes\('AVAILABILITY_OVERLAP'\)/);
  assert.match(route, /error: 'AVAILABILITY_OVERLAP' }, 409/);
  assert.match(route, /error: 'AVAILABILITY_WRITE_REJECTED' }, 409/);
});

test("availability API requires an explicit timezone and rejects unsafe durations", () => {
  assert.match(route, /const isoWithZone =/);
  assert.match(route, /startMs < now \+ 5 \* 60 \* 1000/);
  assert.match(route, /endMs - startMs < 15 \* 60 \* 1000/);
  assert.match(route, /endMs - startMs > 24 \* 60 \* 60 \* 1000/);
  assert.match(route, /startMs > now \+ 366 \* 24 \* 60 \* 60 \* 1000/);
});

test("database rejects malformed, zero-length and reversed active availability intervals", () => {
  assert.match(validationMigration, /julianday\(NEW\.start_at\) IS NULL/);
  assert.match(validationMigration, /julianday\(NEW\.end_at\) IS NULL/);
  assert.match(validationMigration, /julianday\(NEW\.end_at\) <= julianday\(NEW\.start_at\)/);
  assert.equal((validationMigration.match(/RAISE\(ABORT, 'AVAILABILITY_INTERVAL_INVALID'\)/g) || []).length, 2);
});

test("availability interval validation covers INSERT and UPDATE without changing historical inactive rows", () => {
  assert.match(validationMigration, /BEFORE INSERT ON disponibilites/);
  assert.match(validationMigration, /BEFORE UPDATE OF start_at, end_at, status ON disponibilites/);
  assert.match(validationMigration, /WHEN NEW\.status = 'available'/);
});


test("availability POST requires a durable idempotency key scoped to tenant and intervenant", () => {
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /IDEMPOTENCY_KEY_REQUIRED/);
  assert.match(route, /IDEMPOTENCY_KEY_CONFLICT/);
  assert.match(route, /idempotent_replay: true/);
  assert.match(route, /idempotency_key\)/);
  assert.match(route, /WHERE tenant_id = \? AND intervenant_id = \? AND idempotency_key = \?/);
});

test("availability idempotency is enforced by a tenant/profile-scoped unique database index", () => {
  assert.match(idempotencyMigration, /ALTER TABLE disponibilites ADD COLUMN idempotency_key TEXT/);
  assert.match(idempotencyMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_disponibilites_tenant_intervenant_idempotency/);
  assert.match(idempotencyMigration, /ON disponibilites\(tenant_id, intervenant_id, idempotency_key\)/);
  assert.match(idempotencyMigration, /WHERE idempotency_key IS NOT NULL/);
});
