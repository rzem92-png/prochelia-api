import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const previewLedgerNames = [
  '0001_core_business_schema.sql',
  '0002_server_pricing.sql',
  '0003_route_address_provenance.sql',
  '0004_atomic_wallet_ledger.sql',
  '0005_payment_runtime_schema.sql',
  '0005_security_rate_limits.sql',
  '0006_copilot_schema.sql',
  '0006_restore_wallet_balance_guard.sql',
  '0007_trust_passport_schema.sql',
  '0007_unique_provider_account.sql',
  '0008_commercial_recruitment_schema.sql',
  '0008_server_owned_pricing_catalog.sql',
  '0009_final_hardening_schema.sql',
  '0009_finance_workspace_schema.sql',
  '0010_identity_mission_security_schema.sql',
  '0010_strategic_schema.sql',
  '0011_final_hardening_schema.sql',
  '0011_strategic_commercial_schema.sql',
  '0012_consolidated_business_schema.sql',
  '0012_national_continuity_schema.sql',
  '0013_finance_workspace_schema.sql',
  '0013_master_complement_schema.sql',
  '0014_operational_schema.sql',
  '0015_commercial_recruitment_schema.sql',
  '0015_production_security_events.sql',
  '0016_national_continuity_schema.sql',
  '0016_security_identity_schema.sql',
  '0017_brand_support_copilot_schema.sql',
  '0017_document_security_scans.sql',
  '0018_consolidated_business_schema.sql',
  '0018_dsa_ai_act_transparency_redress.sql',
  '0019_backup_verifications.sql',
];

test('migration source tree preserves every exact filename recorded by Preview D1', () => {
  const actual = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  assert.deepEqual(actual, [...previewLedgerNames].sort());
  assert.equal(actual.length, 32);
});
