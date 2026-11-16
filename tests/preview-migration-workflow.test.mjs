import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/apply-preview-d1-migrations.yml", import.meta.url), "utf8");

test("Preview migration secrets are available only from the reviewed main workflow dispatch", () => {
  assert.match(workflow, /if: \$\{\{ github\.ref == 'refs\/heads\/main' && inputs\.confirm_preview == 'APPLY_PREVIEW_ONLY' \}\}/);
  assert.doesNotMatch(workflow, /if: \$\{\{ github\.event\.inputs\.confirm_preview == 'APPLY_PREVIEW_ONLY' \}\}/);
});

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
    "0020_auth_login_rate_limits.sql",
    "0021_supra_audit_events.sql",
    "0022_supra_persisted_approvals.sql"
  ];
  for (const migration of expected) assert.ok(workflow.includes(`"${migration}"`), `missing canonical migration ${migration}`);
});

test("Preview migration workflow encrypts and integrity-checks backup before schema writes", () => {
  const backup = workflow.indexOf("Encrypt and verify fresh backup");
  const publish = workflow.indexOf("Publish encrypted backup before any schema write");
  const apply = workflow.indexOf("Apply migrations to Preview D1 only");
  assert.ok(backup >= 0 && publish > backup && apply > publish);
  assert.match(workflow, /cipher-algo AES256/);
  assert.match(workflow, /sha256sum.*manifest\.sha256/);
  assert.match(workflow, /expected=.*cat.*manifest\.sha256/);
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
    "idx_auth_login_rate_limits_window",
    "0021_supra_audit_events.sql",
    "supra_audit_events",
    "idx_supra_audit_events_created_at",
    "idx_supra_audit_events_actor",
    "0022_supra_persisted_approvals.sql",
    "supra_approval_requests", "supra_approval_votes", "supra_approval_events",
    "idx_supra_approval_requests_status_expiry", "idx_supra_approval_requests_tenant_resource",
    "idx_supra_approval_votes_request", "idx_supra_approval_events_request",
    "trg_supra_approval_requests_immutable", "trg_supra_approval_votes_no_update",
    "trg_supra_approval_votes_no_delete", "trg_supra_approval_events_no_update",
    "trg_supra_approval_events_no_delete", "trg_supra_approval_status_transitions",
    "trg_supra_approval_status_evidence"
  ]) assert.ok(workflow.includes(name), `missing post-migration verification for ${name}`);
});

test("Preview migration workflow accepts only the reviewed pre- and post-0022 registries", () => {
  const legacy = [
    "0005_payment_runtime_schema.sql",
    "0006_restore_wallet_balance_guard.sql",
    "0007_unique_provider_account.sql",
    "0008_server_owned_pricing_catalog.sql",
    "0009_final_hardening_schema.sql",
    "0010_identity_mission_security_schema.sql",
    "0011_strategic_commercial_schema.sql",
    "0012_consolidated_business_schema.sql",
    "0013_finance_workspace_schema.sql",
    "0015_commercial_recruitment_schema.sql",
    "0016_national_continuity_schema.sql",
    "0017_brand_support_copilot_schema.sql",
    "0018_dsa_ai_act_transparency_redress.sql"
  ];
  for (const name of legacy) assert.ok(workflow.includes(`"${name}"`), `legacy migration not explicitly allowlisted: ${name}`);
  assert.match(workflow, /pending=\{"0021_supra_audit_events\.sql", "0022_supra_persisted_approvals\.sql"\}/);
  assert.match(workflow, /baseline=\(local-pending\)\|legacy/);
  assert.match(workflow, /fully_applied=local\|legacy/);
  assert.match(workflow, /remote == baseline/);
  assert.match(workflow, /remote == fully_applied/);
  assert.match(workflow, /both reviewed safe states/);
});

test("Preview migration workflow verifies the final registry exactly after applying the pending migrations", () => {
  assert.match(workflow, /Verify exact reviewed Preview migration registry after apply/);
  assert.match(workflow, /expected=local\|legacy/);
  assert.match(workflow, /remote != expected/);
  assert.match(workflow, /final Preview migration registry exactly matches/);
});

test("Preview D1 migration requires an encrypted R2 EU backup round-trip before any schema write", () => {
  assert.match(workflow, /AWS_ACCESS_KEY_ID: \$\{\{ secrets\.R2_EU_ACCESS_KEY_ID \}\}/);
  assert.match(workflow, /AWS_SECRET_ACCESS_KEY: \$\{\{ secrets\.R2_EU_SECRET_ACCESS_KEY \}\}/);
  assert.match(workflow, /R2_BUCKET: prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /R2_ENDPOINT: https:\/\/f2a79e9fa41566a8ec80fb24c02c60eb\.eu\.r2\.cloudflarestorage\.com/);
  const upload = workflow.indexOf("Upload encrypted backup and manifest to private R2 EU bucket");
  const verify = workflow.indexOf("Download R2 backup and verify encrypted round-trip");
  const artifact = workflow.indexOf("Publish encrypted backup before any schema write");
  const apply = workflow.indexOf("Apply migrations to Preview D1 only");
  assert.ok(upload >= 0 && verify > upload && artifact > verify && apply > artifact);
  assert.match(workflow, /PRAGMA integrity_check/);
  assert.match(workflow, /R2 round-trip checksum mismatch/);
});

test("Preview migration refuses to export D1 unless R2 bucket jurisdiction is verified as EU", () => {
  const eu = workflow.indexOf("Verify R2 backup bucket EU jurisdiction before exporting sensitive D1 data");
  const exportStep = workflow.indexOf("Export only Preview D1 before migration");
  const upload = workflow.indexOf("Upload encrypted backup and manifest to private R2 EU bucket");
  const apply = workflow.indexOf("Apply migrations to Preview D1 only");
  assert.ok(eu >= 0 && exportStep > eu && upload > exportStep && apply > upload);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /\.result\.jurisdiction == "eu"/);
});


test("Preview migration workflow pins the exact CI-validated Nexus source commit", () => {
  assert.match(workflow, /ref: 01be347463a992040cc8c5ad6ee84c6a2411df1e/);
  assert.doesNotMatch(workflow, /ref: integration\/nexus-supra-core-preview-2026-11-16/);
  assert.match(workflow, /0021_supra_audit_events\.sql/);
  assert.match(workflow, /0022_supra_persisted_approvals\.sql/);
});

test("Preview migration workflow verifies every persisted approval table, index and trigger", () => {
  for (const name of [
    "supra_approval_requests",
    "supra_approval_votes",
    "supra_approval_events",
    "idx_supra_approval_requests_status_expiry",
    "idx_supra_approval_requests_tenant_resource",
    "idx_supra_approval_votes_request",
    "idx_supra_approval_events_request",
    "trg_supra_approval_requests_immutable",
    "trg_supra_approval_votes_no_update",
    "trg_supra_approval_votes_no_delete",
    "trg_supra_approval_events_no_update",
    "trg_supra_approval_events_no_delete",
    "trg_supra_approval_status_transitions",
    "trg_supra_approval_status_evidence"
  ]) assert.ok(workflow.includes(name), `missing persisted approval schema verification: ${name}`);
  assert.match(workflow, /actual_triggers != expected_triggers/);
});
