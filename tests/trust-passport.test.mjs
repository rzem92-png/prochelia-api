import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTaskEligibility } from '../src/trust-passport.js';

const missionAt = '2026-11-10T10:00:00.000Z';
const service = {
  service_code: 'ACCOMPAGNEMENT_NON_MEDICAL',
  status: 'ACTIVE',
  require_identity: true,
  requirements: [{ category: 'QUALIFICATION', required: true }]
};
const profile = { status: 'ACTIVE' };
const identity = { category: 'IDENTITY', status: 'IDENTITY_VERIFIED', service_code: 'ACCOMPAGNEMENT_NON_MEDICAL' };
const qualification = { category: 'QUALIFICATION', status: 'QUALIFICATION_VERIFIED', service_code: 'ACCOMPAGNEMENT_NON_MEDICAL', expires_at: '2027-01-01T00:00:00.000Z' };

test('Trust Passport allows only an active profile with identity and service-specific qualification', () => {
  const result = evaluateTaskEligibility({ service, profile, verifications: [identity, qualification], missionAt });
  assert.deepEqual(result, { decision: 'ELIGIBLE', reasons: [] });
});

test('missing identity or qualification blocks eligibility', () => {
  const missingIdentity = evaluateTaskEligibility({ service, profile, verifications: [qualification], missionAt });
  assert.equal(missingIdentity.decision, 'BLOCKED');
  assert.ok(missingIdentity.reasons.includes('IDENTITY_VERIFICATION_REQUIRED'));
  const missingQualification = evaluateTaskEligibility({ service, profile, verifications: [identity], missionAt });
  assert.ok(missingQualification.reasons.includes('VERIFICATION_REQUIRED:QUALIFICATION:ACCOMPAGNEMENT_NON_MEDICAL'));
});

test('qualification verified for another service is not transferable by default', () => {
  const otherServiceQualification = { ...qualification, service_code: 'MENAGE' };
  const result = evaluateTaskEligibility({ service, profile, verifications: [identity, otherServiceQualification], missionAt });
  assert.equal(result.decision, 'BLOCKED');
});

test('expired, future-dated, pending, and wrong-status evidence is rejected', () => {
  const cases = [
    { ...qualification, expires_at: '2026-11-10T10:00:00.000Z' },
    { ...qualification, valid_from: '2026-11-11T00:00:00.000Z' },
    { ...qualification, status: 'DOCUMENT_REVIEW_PENDING' },
    { ...qualification, status: 'EXPERIENCE_DECLARED' }
  ];
  for (const evidence of cases) {
    const result = evaluateTaskEligibility({ service, profile, verifications: [identity, evidence], missionAt });
    assert.equal(result.decision, 'BLOCKED');
  }
});

test('draft or suspended service and suspended profile fail closed', () => {
  assert.equal(evaluateTaskEligibility({ service: { ...service, status: 'DRAFT' }, profile, verifications: [identity, qualification], missionAt }).decision, 'BLOCKED');
  assert.equal(evaluateTaskEligibility({ service, profile: { status: 'SUSPENDED' }, verifications: [identity, qualification], missionAt }).decision, 'BLOCKED');
  assert.equal(evaluateTaskEligibility({ service, profile: { ...profile, suspended: true }, verifications: [identity, qualification], missionAt }).decision, 'BLOCKED');
});

test('global evidence is always rejected, including legacy catalogue opt-in', () => {
  const globalIdentity = { ...identity, service_code: '*' };
  const globalQualification = { ...qualification, service_code: '*' };
  const denied = evaluateTaskEligibility({ service, profile, verifications: [globalIdentity, globalQualification], missionAt });
  assert.equal(denied.decision, 'BLOCKED');
  const legacyOptIn = evaluateTaskEligibility({ service: { ...service, allow_global_scope: true }, profile, verifications: [globalIdentity, globalQualification], missionAt });
  assert.equal(legacyOptIn.decision, 'BLOCKED');
  assert.ok(legacyOptIn.reasons.includes('GLOBAL_EVIDENCE_SCOPE_PROHIBITED'));
});

test('missing or invalid mission date and incomplete server data block eligibility', () => {
  assert.equal(evaluateTaskEligibility({ service, profile, verifications: [identity, qualification], missionAt: 'not-a-date' }).decision, 'BLOCKED');
  assert.equal(evaluateTaskEligibility({ service, profile, verifications: null, missionAt }).decision, 'BLOCKED');
  assert.equal(evaluateTaskEligibility({ service: null, profile, verifications: [identity, qualification], missionAt }).decision, 'BLOCKED');
});

test('insurance and authorization evidence must always carry a future expiry date', () => {
  for (const category of ['INSURANCE', 'AUTHORIZATION']) {
    const evidence = { category, status: 'DOCUMENT_VERIFIED', service_code: service.service_code, requires_expiry: false };
    const withoutExpiry = evaluateTaskEligibility({
      service: { ...service, requirements: [{ category, required: true }] },
      profile, verifications: [identity, evidence], missionAt
    });
    assert.equal(withoutExpiry.decision, 'BLOCKED', category);
    const expired = evaluateTaskEligibility({
      service: { ...service, requirements: [{ category, required: true }] },
      profile, verifications: [identity, { ...evidence, expires_at: '2026-11-10T10:00:00.000Z' }], missionAt
    });
    assert.equal(expired.decision, 'BLOCKED', category);
  }
});

test('evidence for another service cannot satisfy insurance or authorization requirements', () => {
  for (const category of ['INSURANCE', 'AUTHORIZATION']) {
    const evidence = { category, status: 'DOCUMENT_VERIFIED', service_code: 'OTHER_SERVICE', expires_at: '2027-01-01T00:00:00.000Z', requires_expiry: true };
    const result = evaluateTaskEligibility({
      service: { ...service, requirements: [{ category, required: true }] },
      profile, verifications: [identity, evidence], missionAt
    });
    assert.equal(result.decision, 'BLOCKED', category);
  }
});
