import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/apply-preview-d1-migrations.yml", import.meta.url), "utf8");

test("Preview migration workflow pins the dedicated Preview database and forbids production", () => {
  assert.match(workflow, /EXPECTED_DB_NAME:\s*prochelia-preview-db/);
  assert.match(workflow, /EXPECTED_DB_ID:\s*6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.match(workflow, /FORBIDDEN_PRODUCTION_DB_ID:/);
  assert.match(workflow, /test "\$EXPECTED_DB_ID" != "\$FORBIDDEN_PRODUCTION_DB_ID"/);
  assert.match(workflow, /confirm_preview == 'APPLY_PREVIEW_ONLY'/);
});

test("Preview migration workflow validates the full canonical migration chain", () => {
  const expected = [
    "0001_core_business_schema.sql",
    "0002_server_pricing.sql",
    "0003_route_address_provenance.sql",
    "0004_atomic_wallet_ledger.sql",
    "0005_security_rate_limits.sql",
    "0006_copilot_schema.sql",
    "0007_trust_passport_schema.sql",
    "0008_commercial_recruitment_schema.sql",
    "0009_finance_workspace_schema.sql",
    "0010_strategic_schema.sql",
    "0011_final_hardening_schema.sql",
    "0012_national_continuity_schema.sql",
    "0013_master_complement_schema.sql",
    "0014_operational_schema.sql",
    "0015_production_security_events.sql",
    "0016_security_identity_schema.sql",
    "0017_document_security_scans.sql",
    "0018_consolidated_business_schema.sql",
    "0019_backup_verifications.sql",
    "0020_auth_login_rate_limits.sql"
  ];
  for (const migration of expected) assert.ok(workflow.includes(`"${migration}"`), `missing canonical migration ${migration}`);
});

test("Preview migration workflow encrypts and integrity-checks backup before schema writes", () => {
  const backup = workflow.indexOf("Encrypt and verify fresh backup");
  const publish = workflow.indexOf("Publish encrypted backup before any schema write");
  const apply = workflow.indexOf("Apply migrations to Preview D1 only");
  assert.ok(backup >= 0 && publish > backup && apply > publish);
  assert.match(workflow, /cipher-algo AES256/);
  assert.match(workflow, /expected=.*sha256sum/);
  assert.match(workflow, /actual=.*sha256sum/);
  assert.match(workflow, /test "\$expected" = "\$actual"/);
});

test("Preview post-migration verification checks identity, mission-security and rate-limit schema", () => {
  for (const name of [
    "0016_security_identity_schema.sql",
    "identity_verifications",
    "trusted_devices",
    "mission_security",
    "mission_security_attempts",
    "security_audit",
    "idx_identity_verifications_user",
    "idx_mission_security_intervenant",
    "idx_security_attempts_security",
    "idx_security_audit_mission",
    "0020_auth_login_rate_limits.sql",
    "auth_login_rate_limits",
    "idx_auth_login_rate_limits_window"
  ]) assert.ok(workflow.includes(name), `missing post-migration verification for ${name}`);
});
