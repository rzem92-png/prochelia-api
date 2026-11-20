import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function intervenantWorkspaceReadModel(");
const end = source.indexOf("\nasync function intervenantAvailabilityRoute(", start);
assert.ok(start >= 0 && end > start, "workspace read model must exist in canonical API Worker");
const handler = source.slice(start, end);

test("intervenant workspace is routed through the canonical API Worker and GET only", () => {
  assert.match(source, /url\.pathname === '\/api\/intervenant\/workspace'/);
  assert.match(handler, /request\.method !== 'GET'[\s\S]{0,80}METHOD_NOT_ALLOWED/);
});

test("workspace requires an authenticated intervenant role", () => {
  assert.match(handler, /getSessionUser\(request, env\)/);
  assert.match(handler, /requireRole\(auth, \['intervenant'\]\)/);
  assert.match(handler, /AUTHENTICATION_SCHEMA_UNAVAILABLE/);
  assert.match(handler, /AUTHENTICATION_SCHEMA_UNAVAILABLE' \}, 503/);
  assert.match(handler, /UNAUTHENTICATED/);
  assert.match(handler, /FORBIDDEN/);
});

test("workspace resources are scoped to the authenticated owner", () => {
  assert.ok(handler.includes("FROM intervenants WHERE user_id = ? AND tenant_id = ?"));
  assert.ok(handler.includes("WHERE m.intervenant_id = ? AND m.tenant_id = ?"));
  assert.ok(handler.includes("p.id = m.prestation_id AND p.tenant_id = m.tenant_id"));
  assert.ok(handler.includes("FROM disponibilites WHERE intervenant_id = ? AND tenant_id = ?"));
  assert.ok(handler.includes("FROM wallets WHERE user_id = ? AND tenant_id = ?"));
  assert.ok(handler.includes("FROM documents WHERE user_id = ? AND tenant_id = ?"));
});

test("workspace response is read-only and excludes client addresses and raw document references", () => {
  assert.match(handler, /read_only: true/);
  assert.match(handler, /writes: false/);
  assert.doesNotMatch(handler, /m\.address|file_reference|provider_account_id|INSERT INTO|UPDATE\s+wallets/);
});

test("missing optional workspace tables are reported as partial data, not fabricated", () => {
  assert.match(handler, /partial\.push\('missions'\)/);
  assert.match(handler, /partial\.push\('availability'\)/);
  assert.match(handler, /partial\.push\('wallet'\)/);
  assert.match(handler, /partial\.push\('documents'\)/);
});

test("workspace fails closed until an active tenant and tenant-scoped business tables exist", () => {
  assert.match(handler, /ACTIVE_TENANT_REQUIRED/);
  assert.match(handler, /BUSINESS_TENANT_SCHEMA_UNAVAILABLE/);
  assert.match(handler, /PRAGMA table_info/);
  for (const table of ["intervenants", "missions", "prestations", "disponibilites", "wallets", "documents"]) {
    assert.ok(handler.includes("'" + table + "'"));
  }
  assert.match(handler, /auth\.session_active_tenant_id/);
});

const opportunityStart = source.indexOf("async function intervenantOpportunityRoute(");
const opportunityEnd = source.indexOf("\nasync function handle(request,env){", opportunityStart);
assert.ok(opportunityStart >= 0 && opportunityEnd > opportunityStart, "opportunity route must exist before canonical Worker dispatch");
const opportunityHandler = source.slice(opportunityStart, opportunityEnd);

test("opportunity feed is GET-only, authenticated and restricted to verified intervenants", () => {
  assert.match(opportunityHandler, /request\.method !== 'GET'[\s\S]{0,100}METHOD_NOT_ALLOWED/);
  assert.match(opportunityHandler, /getSessionUser\(request, env\)/);
  assert.match(opportunityHandler, /requireRole\(auth, \['intervenant'\]\)/);
  assert.match(opportunityHandler, /PROFILE_VALIDATION_REQUIRED/);
  assert.match(opportunityHandler, /session_active_tenant_id/);
  assert.match(opportunityHandler, /verification_status = 'VERIFIED'/);
});

test("opportunity feed returns a sanitized public projection with availability and conflict checks", () => {
  assert.match(opportunityHandler, /o\.public_summary/);
  assert.match(opportunityHandler, /o\.city/);
  assert.match(opportunityHandler, /o\.provider_pay_cents/);
  assert.match(opportunityHandler, /FROM disponibilites d/);
  assert.match(opportunityHandler, /FROM mission_assignments ma/);
  assert.doesNotMatch(opportunityHandler, /o\.address|client_user_id|file_reference/);
});

test("applications are POST-only, idempotent and never accept client-controlled pay or tenant identity", () => {
  assert.match(opportunityHandler, /request\.method !== 'POST'[\s\S]{0,100}METHOD_NOT_ALLOWED/);
  assert.match(opportunityHandler, /Idempotency-Key/);
  assert.match(opportunityHandler, /IDEMPOTENCY_KEY_CONFLICT/);
  assert.match(opportunityHandler, /INSERT INTO mission_applications/);
  assert.match(opportunityHandler, /opportunity\.provider_pay_cents/);
  assert.match(opportunityHandler, /opportunity\.owner_tenant_id/);
  assert.match(opportunityHandler, /auth\.user\.id/);
  assert.doesNotMatch(opportunityHandler, /payload\.provider_pay_cents|payload\.owner_tenant_id|payload\.applicant_tenant_id/);
});

test("canonical Worker dispatch exposes only the exact intervenant opportunity routes", () => {
  assert.match(source, /url\.pathname === '\/api\/intervenant\/opportunities'/);
  assert.match(source, /intervenantOpportunityRoute\(request, env, url\)/);
  assert.match(source, /url\.pathname === '\/api\/intervenant\/workspace'/);
});

const availabilityStart = source.indexOf("async function intervenantAvailabilityRoute(");
const availabilityEnd = source.indexOf("\nasync function intervenantOpportunityRoute(", availabilityStart);
assert.ok(availabilityStart >= 0 && availabilityEnd > availabilityStart, "availability route must exist in canonical API Worker");
const availabilityHandler = source.slice(availabilityStart, availabilityEnd);

test("intervenant availability reads and writes only the authenticated user's active tenant", () => {
  for (const fragment of [
    "getSessionUser(request, env)",
    "requireRole(auth, ['intervenant'])",
    "auth.session_active_tenant_id",
    "WHERE user_id = ? AND tenant_id = ?",
    "WHERE intervenant_id = ? AND tenant_id = ?",
    "INSERT INTO disponibilites(id, intervenant_id, tenant_id, start_at, end_at, status)"
  ]) assert.ok(availabilityHandler.includes(fragment), "missing tenant-safe availability guard: " + fragment);
});

test("availability writes reject invalid time windows and overlapping slots", () => {
  for (const fragment of [
    "isoWithZone.test(startAt)",
    "INVALID_AVAILABILITY_WINDOW",
    "AVAILABILITY_OVERLAP",
    "julianday(start_at) < julianday(?)",
    "julianday(end_at) > julianday(?)",
    "new Date(startMs).toISOString()",
    "new Date(endMs).toISOString()",
    "endMs - startMs > 24 * 60 * 60 * 1000"
  ]) assert.ok(availabilityHandler.includes(fragment), "missing availability validation: " + fragment);
});

test("availability API is registered in the canonical Worker and fails closed on unsupported methods", () => {
  assert.ok(availabilityHandler.includes("!['GET', 'POST'].includes(request.method)"));
  assert.ok(source.includes("url.pathname === '/api/intervenant/availability'"));
  assert.ok(source.includes("intervenantAvailabilityRoute(request, env, url)"));
});


test("direct opportunity applications recheck assignment conflicts instead of trusting the public feed", () => {
  for (const fragment of [
    "SELECT ma.id",
    "FROM mission_assignments ma",
    "ma.provider_tenant_id = ? AND ma.intervenant_id = ?",
    "ma.status IN ('ASSIGNED','IN_PROGRESS','DISPUTED')",
    "assigned.start_at < ? AND assigned.end_at > ?",
    "INTERVENANT_SCHEDULE_CONFLICT"
  ]) assert.ok(opportunityHandler.includes(fragment), "missing direct-application conflict guard: " + fragment);
});

const assignmentStart = source.indexOf("async function intervenantAssignmentsRoute(");
const assignmentEnd = source.indexOf("async function intervenantAvailabilityRoute(", assignmentStart);
assert.ok(assignmentStart >= 0 && assignmentEnd > assignmentStart, "assignment read route must exist");
const assignmentHandler = source.slice(assignmentStart, assignmentEnd);

test("intervenant assignments are read-only and restricted to the authenticated tenant profile", () => {
  assert.ok(source.includes("url.pathname === '/api/intervenant/assignments'"));
  for (const fragment of [
    "request.method !== 'GET'",
    "getSessionUser(request, env)",
    "requireRole(auth, ['intervenant'])",
    "auth.session_active_tenant_id",
    "WHERE a.provider_tenant_id = ? AND a.intervenant_id = ?",
    "read_only: true",
    "assignments: result.results"
  ]) assert.ok(assignmentHandler.includes(fragment), "missing assignment read guard: " + fragment);
  assert.doesNotMatch(assignmentHandler, /INSERT INTO|UPDATE\\s+mission_assignments|o\\.address|client_user_id/);
});

const applicationStart = source.indexOf("async function intervenantApplicationsRoute(");
const applicationEnd = source.indexOf("async function intervenantAssignmentsRoute(", applicationStart);
assert.ok(applicationStart >= 0 && applicationEnd > applicationStart, "application read route must exist");
const applicationHandler = source.slice(applicationStart, applicationEnd);

test("intervenant application tracking is read-only and tenant-scoped", () => {
  assert.ok(source.includes("url.pathname === '/api/intervenant/applications'"));
  for (const fragment of [
    "request.method !== 'GET'",
    "getSessionUser(request, env)",
    "requireRole(auth, ['intervenant'])",
    "auth.session_active_tenant_id",
    "WHERE a.applicant_tenant_id = ? AND a.intervenant_id = ?",
    "read_only: true",
    "applications: result.results"
  ]) assert.ok(applicationHandler.includes(fragment), "missing application read guard: " + fragment);
  assert.doesNotMatch(applicationHandler, /INSERT INTO|UPDATE\\s+mission_applications|o\\.address|client_user_id/);
});


const withdrawalStart = source.indexOf("async function intervenantApplicationWithdrawRoute(");
const withdrawalEnd = source.indexOf("async function intervenantApplicationsRoute(", withdrawalStart);
assert.ok(withdrawalStart >= 0 && withdrawalEnd > withdrawalStart, "application withdrawal route must exist");
const withdrawalHandler = source.slice(withdrawalStart, withdrawalEnd);

test("intervenant can withdraw only their own pending application within their active tenant", () => {
  for (const fragment of [
    "request.method !== 'POST'",
    "getSessionUser(request, env)",
    "requireRole(auth, ['intervenant'])",
    "auth.session_active_tenant_id",
    "WHERE id = ? AND applicant_tenant_id = ? AND intervenant_id = ?",
    "status IN ('SUBMITTED', 'SHORTLISTED')",
    "SET status = 'WITHDRAWN'",
    "APPLICATION_NOT_FOUND",
    "APPLICATION_NOT_WITHDRAWABLE"
  ]) assert.ok(withdrawalHandler.includes(fragment), "missing withdrawal guard: " + fragment);
  assert.doesNotMatch(withdrawalHandler, /owner_tenant_id = \?/);
});
test("withdrawal route is dispatched only for the exact application path", () => {
  assert.ok(source.includes("intervenantApplicationWithdrawRoute(request, env, url)"));
  assert.ok(source.includes("/api/intervenant/applications/[^/]+/withdraw"));
});


const withdrawalStart = source.indexOf("async function intervenantApplicationWithdrawRoute(");
const withdrawalEnd = source.indexOf("async function intervenantApplicationsRoute(", withdrawalStart);
assert.ok(withdrawalStart >= 0 && withdrawalEnd > withdrawalStart, "application withdrawal route must exist");
const withdrawalHandler = source.slice(withdrawalStart, withdrawalEnd);
test("intervenant can withdraw only their own pending application", () => {
  assert.ok(source.includes("intervenantApplicationWithdrawRoute(request, env, url)"));
  for (const fragment of [
    "request.method !== 'POST'",
    "getSessionUser(request, env)",
    "requireRole(auth, ['intervenant'])",
    "WHERE id = ? AND applicant_tenant_id = ? AND intervenant_id = ?",
    "status IN ('SUBMITTED', 'SHORTLISTED')",
    "APPLICATION_NOT_WITHDRAWABLE",
    "APPLICATION_NOT_FOUND"
  ]) assert.ok(withdrawalHandler.includes(fragment), "missing withdrawal guard: " + fragment);
  assert.doesNotMatch(withdrawalHandler, /owner_tenant_id\s*=\s*\?/);
});
