import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIdentityDecision, isCurrentIdentityEvidence } from "../src/identity-evidence.js";

const now = Date.parse("2026-10-31T10:00:00.000Z");
const validEvidence = {
  status: "verified",
  provider: "manual_control",
  provider_reference: "CASE-2026-10-31-001",
  verified_at: "2026-10-31T09:00:00.000Z",
  expires_at: "2026-11-30T09:00:00.000Z"
};

test("manual identity approval requires a traceable evidence reference", () => {
  assert.equal(normalizeIdentityDecision({status:"verified"}).error, "IDENTITY_EVIDENCE_REFERENCE_REQUIRED");
  assert.equal(normalizeIdentityDecision({status:"verified",provider_reference:"short"}).ok, false);
  assert.equal(normalizeIdentityDecision({status:"verified",provider_reference:"CASE-2026-10-31-001"}).ok, true);
});

test("identity decisions reject unsupported providers, levels and states", () => {
  assert.equal(normalizeIdentityDecision({status:"verified",provider:"unverified-vendor",provider_reference:"CASE-2026-10-31-001"}).ok, false);
  assert.equal(normalizeIdentityDecision({status:"verified",level:"admin",provider_reference:"CASE-2026-10-31-001"}).ok, false);
  assert.equal(normalizeIdentityDecision({status:"pending"}).ok, false);
  assert.equal(normalizeIdentityDecision([]).ok, false);
});

test("identity rejection requires a bounded reason", () => {
  assert.equal(normalizeIdentityDecision({status:"rejected",rejection_reason:"no"}).error, "IDENTITY_REJECTION_REASON_REQUIRED");
  assert.equal(normalizeIdentityDecision({status:"rejected",rejection_reason:"Document illisible et non conforme"}).ok, true);
  assert.equal(normalizeIdentityDecision({status:"rejected",rejection_reason:"x".repeat(501)}).ok, false);
});

test("only verified, referenced, dated, unexpired manual evidence is accepted", () => {
  assert.equal(isCurrentIdentityEvidence(validEvidence, now), true);
  assert.equal(isCurrentIdentityEvidence({...validEvidence, expires_at:null}, now), false);
  assert.equal(isCurrentIdentityEvidence({...validEvidence, provider_reference:null}, now), false);
  assert.equal(isCurrentIdentityEvidence({...validEvidence, provider:"external-unconfigured"}, now), false);
  assert.equal(isCurrentIdentityEvidence({...validEvidence, status:"pending"}, now), false);
});

test("identity evidence fails closed for expired, future-dated or excessive validity windows", () => {
  assert.equal(isCurrentIdentityEvidence({...validEvidence, expires_at:"2026-10-31T09:59:59.000Z"}, now), false);
  assert.equal(isCurrentIdentityEvidence({...validEvidence, verified_at:"2026-10-31T11:00:00.000Z"}, now), false);
  assert.equal(isCurrentIdentityEvidence({...validEvidence, expires_at:"2027-01-01T00:00:00.000Z"}, now), false);
  assert.equal(isCurrentIdentityEvidence(null, now), false);
});
