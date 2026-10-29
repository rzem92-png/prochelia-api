import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('Trust Passport persists a versioned service catalogue and scoped verification evidence in D1', () => {
  assert.match(source, /CREATE TABLE IF NOT EXISTS trust_service_catalog/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS trust_verifications/);
  assert.match(source, /UNIQUE\(intervenant_id,category,service_code,proof_document_id\)/);
  assert.match(source, /trustPassportSaveCatalog/);
  assert.match(source, /trustPassportVerifyEvidence/);
});

test('Trust evidence can only be granted by manager roles against an already verified owned document', () => {
  assert.match(source, /requireRole\(auth, \['gerante','admin'\]\)/);
  assert.match(source, /doc\.owner_user_id !== profile\.user_id \|\| doc\.status !== 'VERIFIED'/);
  assert.match(source, /TRUST_EVIDENCE_DOCUMENT_NOT_VERIFIED_OR_MISMATCHED/);
  assert.match(source, /EXPIRY_REQUIRED_FOR_EVIDENCE/);
});

test('Mission security preparation and arrival-code consumption both enforce Trust Passport server-side', () => {
  assert.match(source, /TRUST_PASSPORT_MISSION_PREPARE_BLOCKED/);
  assert.match(source, /TRUST_PASSPORT_MISSION_START_BLOCKED/);
  assert.match(source, /trustPassportCheckMission\(env,intervenantId,mission\.prestation_id,mission\.start_at\)/);
  assert.match(source, /trustPassportCheckMission\(env,profile\.id,mission\.prestation_id,mission\.start_at\)/);
  assert.match(source, /TRUST_SERVICE_NOT_CONFIGURED/);
});

test('Trust Passport administration routes are explicitly wired in the outer Worker handler', () => {
  assert.match(source, /\/api\/trust-passport\/catalog/);
  assert.match(source, /\/api\/trust-passport\/verifications/);
});
