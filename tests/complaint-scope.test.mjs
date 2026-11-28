import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateComplaintDraft, resolveComplaintScope } from "../src/complaint-scope.js";

const NOW = new Date("2026-11-28T12:00:00.000Z");
const validClientDraft = {
  category: "service_quality",
  details: "La prestation n'a pas correspondu à la description initiale.",
  incidentDate: "2026-11-27",
  requestReference: "REQ-42",
  desiredOutcome: "clarification",
  privacyAcknowledged: true,
  attachments: []
};
const client = { id: "user-7", role: "client" };
const profile = { id: "client-7", user_id: "user-7" };

test("valid customer draft normalizes fields and accepts legacy snake_case aliases", () => {
  const result = validateComplaintDraft({ ...validClientDraft, client_id: "client-7" }, "client", NOW);
  assert.equal(result.ok, true);
  assert.equal(result.normalized.description, validClientDraft.details);
  assert.equal(result.normalized.requestReference, "REQ-42");
  assert.equal(result.normalized.clientId, "client-7");
});

test("rejects non-object bodies and arrays", () => {
  assert.equal(validateComplaintDraft(null, "client", NOW).ok, false);
  assert.equal(validateComplaintDraft([], "client", NOW).ok, false);
});

test("rejects unsupported customer categories", () => {
  const result = validateComplaintDraft({ ...validClientDraft, category: "refund_now" }, "client", NOW);
  assert.equal(result.ok, false);
  assert.equal(result.errors.category, "CATEGORY_INVALID");
});

test("enforces bounded descriptions and rejects control characters", () => {
  assert.equal(validateComplaintDraft({ ...validClientDraft, details: "short" }, "client", NOW).errors.description, "DESCRIPTION_LENGTH_INVALID");
  assert.equal(validateComplaintDraft({ ...validClientDraft, details: "a".repeat(3001) }, "client", NOW).errors.description, "DESCRIPTION_LENGTH_INVALID");
  assert.equal(validateComplaintDraft({ ...validClientDraft, details: "faits observés\u0000 et autres éléments suffisamment longs" }, "client", NOW).errors.description, "DESCRIPTION_LENGTH_INVALID");
});

test("incident date must be a real date and not in the future", () => {
  assert.equal(validateComplaintDraft({ ...validClientDraft, incidentDate: "2026-02-31" }, "client", NOW).errors.incidentDate, "INCIDENT_DATE_INVALID");
  assert.equal(validateComplaintDraft({ ...validClientDraft, incidentDate: "2026-11-29" }, "client", NOW).errors.incidentDate, "INCIDENT_DATE_FUTURE");
});

test("reference is bounded and restricted to a safe identifier format", () => {
  assert.equal(validateComplaintDraft({ ...validClientDraft, requestReference: "REQ\n42" }, "client", NOW).errors.requestReference, "REQUEST_REFERENCE_INVALID");
  assert.equal(validateComplaintDraft({ ...validClientDraft, requestReference: "x".repeat(81) }, "client", NOW).errors.requestReference, "REQUEST_REFERENCE_INVALID");
});

test("client must choose a desired outcome and details for Other", () => {
  assert.equal(validateComplaintDraft({ ...validClientDraft, desiredOutcome: "" }, "client", NOW).errors.desiredOutcome, "OUTCOME_REQUIRED");
  assert.equal(validateComplaintDraft({ ...validClientDraft, desiredOutcome: "other", desiredOutcomeDetails: "court" }, "client", NOW).errors.desiredOutcomeDetails, "OUTCOME_DETAILS_REQUIRED");
});

test("rejects attachment payloads and missing privacy acknowledgement", () => {
  assert.equal(validateComplaintDraft({ ...validClientDraft, attachments: [{ name: "proof.pdf" }] }, "client", NOW).errors.attachments, "ATTACHMENTS_NOT_ACCEPTED");
  assert.equal(validateComplaintDraft({ ...validClientDraft, privacyAcknowledged: false }, "client", NOW).errors.privacyAcknowledged, "PRIVACY_ACK_REQUIRED");
});

test("client scope is derived from authenticated profile, not body client id", () => {
  const draft = validateComplaintDraft({ ...validClientDraft, client_id: "client-7" }, "client", NOW).normalized;
  assert.deepEqual(resolveComplaintScope(client, draft, { clientProfile: profile }), {
    ok: true, scope: { client_type: "B2C", client_id: "client-7", company_id: null, mission_id: null, severity: "MEDIUM" }
  });
  const mismatch = resolveComplaintScope(client, { ...draft, clientId: "other-client" }, { clientProfile: profile });
  assert.equal(mismatch.error, "CLIENT_OWNERSHIP_MISMATCH");
  assert.equal(mismatch.status, 403);
});

test("client profile absence, company scope and unowned mission fail closed", () => {
  const draft = validateComplaintDraft(validClientDraft, "client", NOW).normalized;
  assert.equal(resolveComplaintScope(client, draft, {}).error, "CLIENT_PROFILE_NOT_FOUND");
  assert.equal(resolveComplaintScope(client, draft, { clientProfile: { id: "client-7", user_id: "different-user" } }).error, "CLIENT_PROFILE_ACTOR_MISMATCH");
  assert.equal(resolveComplaintScope(client, { ...draft, companyId: "company-1" }, { clientProfile: profile }).error, "COMPANY_SCOPE_NOT_ALLOWED");
  assert.equal(resolveComplaintScope(client, { ...draft, missionId: "mission-1" }, { clientProfile: profile }).error, "MISSION_NOT_FOUND");
  assert.equal(resolveComplaintScope(client, { ...draft, missionId: "mission-1" }, { clientProfile: profile, mission: { id: "mission-1", client_id: "other-client" } }).error, "MISSION_OWNERSHIP_MISMATCH");
});

test("owned mission is accepted and its id is server-bound", () => {
  const draft = validateComplaintDraft({ ...validClientDraft, mission_id: "mission-1" }, "client", NOW).normalized;
  const result = resolveComplaintScope(client, draft, { clientProfile: profile, mission: { id: "mission-1", client_id: "client-7" } });
  assert.equal(result.ok, true);
  assert.equal(result.scope.mission_id, "mission-1");
});

test("client cannot elevate severity; sensitive category is escalated by policy", () => {
  const low = validateComplaintDraft({ ...validClientDraft, severity: "CRITICAL" }, "client", NOW).normalized;
  assert.equal(resolveComplaintScope(client, low, { clientProfile: profile }).scope.severity, "MEDIUM");
  const high = validateComplaintDraft({ ...validClientDraft, category: "safety_concern", severity: "LOW" }, "client", NOW).normalized;
  assert.equal(resolveComplaintScope(client, high, { clientProfile: profile }).scope.severity, "HIGH");
});

test("manager scope requires existing profiles and does not infer company-mission linkage", () => {
  const draft = validateComplaintDraft({ ...validClientDraft, client_id: "client-7", severity: "HIGH" }, "gerante", NOW).normalized;
  const result = resolveComplaintScope({ id: "manager-1", role: "gerante" }, draft, { clientProfile: profile });
  assert.equal(result.ok, true);
  assert.equal(result.scope.severity, "HIGH");
  assert.equal(result.scope.client_type, "B2C");
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, draft, {}).error, "CLIENT_NOT_FOUND");
  const companyDraft = validateComplaintDraft({ ...validClientDraft, company_id: "company-1" }, "gerante", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, companyDraft, { companyProfile: { id: "company-1", status: "active" } }).scope.client_type, "B2B");
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, { ...companyDraft, missionId: "mission-1" }, { companyProfile: { id: "company-1", status: "active" }, mission: { id: "mission-1", client_id: "client-7" }, clientProfile: profile }).error, "COMPANY_MISSION_SCOPE_UNVERIFIED");
});

test("company actor and unsupported roles are rejected until scope is verified", () => {
  const draft = validateComplaintDraft(validClientDraft, "entreprise", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "company-user", role: "entreprise" }, draft, {}).error, "COMPANY_SCOPE_NOT_VERIFIED");
  assert.equal(resolveComplaintScope({ id: "provider", role: "intervenant" }, draft, {}).error, "ROLE_NOT_ALLOWED");
});

test("manager severity must be one of the explicit values", () => {
  const invalid = validateComplaintDraft({ ...validClientDraft, severity: "UNBOUNDED" }, "gerante", NOW);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.severity, "SEVERITY_INVALID");
});

test("route integration validates bounded input and uses derived scope before complaint write", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function complaintCreate");
  const end = source.indexOf("\nasync function setPhase", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.match(source, /import \{ validateComplaintDraft, resolveComplaintScope \}/);
  assert.match(route, /readBoundedJson\(request,8192\)/);
  assert.match(route, /validateComplaintDraft\(parsed\.value,actor\.role/);
  assert.match(route, /SELECT id,user_id FROM clients WHERE user_id=\?/);
  assert.match(route, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\?/);
  assert.match(route, /if\(mission&&!clientProfile\)clientProfile=await env\.DB\.prepare\('SELECT id FROM clients WHERE id=\? LIMIT 1'\)/);
  assert.match(route, /resolveComplaintScope\(actor,value/);
  assert.match(source, /import \{ normalizeComplaintIdempotencyKey, buildComplaintIdempotencyIdentity, reserveComplaintIntake, persistComplaintCaseLink \}/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /reserveComplaintIntake\(env\.DB,identity,candidateId/);
  assert.match(route, /persistComplaintCaseLink\(env\.DB,identity,complaintId/);
  assert.match(route, /IDEMPOTENCY_KEY_REUSED/);
  assert.doesNotMatch(route, /\.bind\(id,String\(b\.client_type/);
  assert.match(route, /const caseType='reclamation_client'/);
  assert.match(route, /case_link_status/);
  assert.match(route, /caseId\?201:202/);
  assert.match(route, /caseHeaders\.delete\('content-length'\)/);
});

test("bounded JSON reader enforces declared and streamed payload size", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function readBoundedJson");
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  const reader = source.slice(start, end);
  assert.match(reader, /content-length/);
  assert.match(reader, /maxBytes/);
  assert.match(reader, /reader\.cancel/);
  assert.match(reader, /total > maxBytes/);
});

test("client actor identity must exactly match the fetched profile user_id", () => {
  const draft = validateComplaintDraft(validClientDraft, "client", NOW).normalized;
  assert.equal(resolveComplaintScope(client, draft, { clientProfile: { id: "client-7", user_id: null } }).error, "CLIENT_PROFILE_ACTOR_MISMATCH");
  assert.equal(resolveComplaintScope({ role: "client" }, draft, { clientProfile: profile }).error, "CLIENT_PROFILE_ACTOR_MISMATCH");
});

test("manager scope rejects mixed client/company identities and inactive company profiles", () => {
  const mixed = validateComplaintDraft({ ...validClientDraft, client_id: "client-7", company_id: "company-1" }, "gerante", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, mixed, { clientProfile: profile, companyProfile: { id: "company-1", status: "active" } }).error, "COMPLAINT_SCOPE_CONFLICT");
  const companyOnly = validateComplaintDraft({ ...validClientDraft, company_id: "company-1" }, "gerante", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, companyOnly, { companyProfile: { id: "company-1", status: "pending" } }).error, "COMPANY_PROFILE_NOT_ACTIVE");
});

test("manager mission scope requires a verified client profile and matches mission owner", () => {
  const missionDraft = validateComplaintDraft({ ...validClientDraft, mission_id: "mission-1" }, "gerante", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, missionDraft, { mission: { id: "mission-1", client_id: "client-7" } }).error, "MISSION_CLIENT_PROFILE_NOT_FOUND");
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, missionDraft, { mission: { id: "mission-1", client_id: "client-7" }, clientProfile: { id: "other-client" } }).error, "MISSION_CLIENT_SCOPE_MISMATCH");
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, missionDraft, { mission: { id: "mission-1", client_id: "client-7" }, clientProfile: profile }).ok, true);
});

test("scope resolver rejects mismatched loaded record ids instead of trusting supplied records", () => {
  const clientMissionDraft = validateComplaintDraft({ ...validClientDraft, mission_id: "mission-requested" }, "client", NOW).normalized;
  assert.equal(resolveComplaintScope(client, clientMissionDraft, { clientProfile: profile, mission: { id: "different-mission", client_id: "client-7" } }).error, "MISSION_ID_MISMATCH");
  const managerClientDraft = validateComplaintDraft({ ...validClientDraft, client_id: "client-7" }, "gerante", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, managerClientDraft, { clientProfile: { id: "other-client" } }).error, "CLIENT_PROFILE_ID_MISMATCH");
  const managerCompanyDraft = validateComplaintDraft({ ...validClientDraft, company_id: "company-7" }, "gerante", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, managerCompanyDraft, { companyProfile: { id: "other-company", status: "active" } }).error, "COMPANY_PROFILE_ID_MISMATCH");
  const managerMissionDraft = validateComplaintDraft({ ...validClientDraft, mission_id: "mission-7" }, "gerante", NOW).normalized;
  assert.equal(resolveComplaintScope({ id: "manager-1", role: "gerante" }, managerMissionDraft, { mission: { id: "other-mission", client_id: "client-7" }, clientProfile: profile }).error, "MISSION_ID_MISMATCH");
});
