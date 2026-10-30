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

test('global evidence is not accepted unless the catalogue explicitly permits it', () => {
  const globalIdentity = { ...identity, service_code: '*' };
  const globalQualification = { ...qualification, service_code: '*' };
  const denied = evaluateTaskEligibility({ service, profile, verifications: [globalIdentity, globalQualification], missionAt });
  assert.equal(denied.decision, 'BLOCKED');
  const explicitlyAllowed = evaluateTaskEligibility({ service: { ...service, allow_global_scope: true }, profile, verifications: [globalIdentity, globalQualification], missionAt });
  assert.equal(explicitlyAllowed.decision, 'ELIGIBLE');
});

test('missing or invalid mission date and incomplete server data block eligibility', () => {
  assert.equal(evaluateTaskEligibility({ service, profile, verifications: [identity, qualification], missionAt: 'not-a-date' }).decision, 'BLOCKED');
  assert.equal(evaluateTaskEligibility({ service, profile, verifications: null, missionAt }).decision, 'BLOCKED');
  assert.equal(evaluateTaskEligibility({ service: null, profile, verifications: [identity, qualification], missionAt }).decision, 'BLOCKED');
});
