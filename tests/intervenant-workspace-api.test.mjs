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
    "INSERT INTO disponibilites(id, intervenant_id, tenant_id, start_at, end_at, status, idempotency_key)"
  ]) assert.ok(availabilityHandler.includes(fragment), "missing tenant-safe availability guard: " + fragment);
});

test("availability writes require a stable idempotency key before persistence", () => {
  assert.match(availabilityHandler, /Idempotency-Key/);
  assert.match(availabilityHandler, /IDEMPOTENCY_KEY_REQUIRED/);
  assert.match(availabilityHandler, /IDEMPOTENCY_KEY_CONFLICT/);
  assert.match(availabilityHandler, /idempotent_replay: true/);
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
  assert.ok(source.includes("url.pathname.match(/^\\/api"));
  assert.ok(source.includes("applications\\/([^/]+)\\/withdraw$/"));
});


test("availability request JSON is bounded while streaming even without Content-Length", async () => {
  const helperStart = source.indexOf("async function readLimitedJson(");
  const helperEnd = source.indexOf("\n\nfunction clean(", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "bounded JSON reader must exist");
  const helper = source.slice(helperStart, helperEnd);
  const readLimitedJson = new Function(helper + "\nreturn readLimitedJson;")();

  const makeRequest = (chunks, contentLength = null) => ({
    headers: { get: (name) => name.toLowerCase() === "content-length" ? contentLength : null },
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      }
    })
  });

  const valid = await readLimitedJson(makeRequest(['{"start_at":"2030-01-01T10:00:00Z"}']));
  assert.equal(valid.ok, true);
  assert.equal(valid.value.start_at, "2030-01-01T10:00:00Z");

  const oversized = await readLimitedJson(makeRequest(["x".repeat(3000), "y".repeat(2000)]), 4096);
  assert.deepEqual(oversized, { ok: false, tooLarge: true });

  const declaredOversized = await readLimitedJson(makeRequest(["{}"], "5000"), 4096);
  assert.deepEqual(declaredOversized, { ok: false, tooLarge: true });

  const malformed = await readLimitedJson(makeRequest(["{not-json}"]));
  assert.deepEqual(malformed, { ok: false, tooLarge: false });
});


test("opportunity application bodies use the same streaming byte limit", () => {
  const start = source.indexOf("async function intervenantOpportunityRoute(");
  const end = source.indexOf("\nasync function handle(request,env){", start);
  assert.ok(start >= 0 && end > start, "opportunity route must exist");
  const route = source.slice(start, end);
  assert.match(route, /readLimitedJson\(request, 4096\)/);
  assert.doesNotMatch(route, /request\.json\(\)/);
  assert.match(route, /REQUEST_TOO_LARGE/);
});

const profileUpdateStart = source.indexOf("async function intervenantProfileUpdateRoute(");
const profileUpdateEnd = source.indexOf("\nasync function handle(request,env){", profileUpdateStart);
assert.ok(profileUpdateStart >= 0 && profileUpdateEnd > profileUpdateStart, "profile update route must exist before canonical Worker dispatch");
const profileUpdateHandler = source.slice(profileUpdateStart, profileUpdateEnd);

test("intervenant profile updates are authenticated, tenant-scoped and limited to editable professional fields", () => {
  for (const fragment of [
    "request.method !== 'PUT'",
    "getSessionUser(request, env)",
    "requireRole(auth, ['intervenant'])",
    "auth.session_active_tenant_id",
    "readLimitedJson(request, 2048)",
    "new Set(['service_area', 'hourly_rate'])",
    "WHERE user_id = ? AND tenant_id = ?",
    "WHERE id = ? AND user_id = ? AND tenant_id = ?",
    "UPDATE intervenants SET service_area = ?, hourly_rate = ?",
    "INVALID_SERVICE_AREA",
    "INVALID_HOURLY_RATE",
    "REQUEST_TOO_LARGE"
  ]) assert.ok(profileUpdateHandler.includes(fragment), "missing profile update guard: " + fragment);
  assert.doesNotMatch(profileUpdateHandler, /validation_status|user_id\\s*=\\s*payload|tenant_id\\s*=\\s*payload|INSERT INTO/);
});

test("profile update endpoint is registered exactly in the canonical Worker", () => {
  assert.ok(source.includes("url.pathname === '/api/intervenant/profile'"));
  assert.ok(source.includes("intervenantProfileUpdateRoute(request, env)"));
});


test("assignment feed joins the opportunity through its owner tenant and never leaks client identity or address", () => {
  assert.ok(assignmentHandler.includes("JOIN mission_opportunities o"));
  assert.ok(assignmentHandler.includes("ON o.id = a.opportunity_id AND o.owner_tenant_id = a.owner_tenant_id"));
  assert.ok(assignmentHandler.includes("WHERE a.provider_tenant_id = ? AND a.intervenant_id = ?"));
  assert.ok(assignmentHandler.includes("o.category_code, o.public_summary, o.city"));
  assert.doesNotMatch(assignmentHandler, /client_user_id|client_id|o\\.address|o\\.private_/);
  assert.doesNotMatch(assignmentHandler, /request\\.json\\(\\)|payload\\.|INSERT INTO|UPDATE\\s+mission_assignments/);
});

test("assignment feed returns only the minimal operational projection needed by the intervenant", () => {
  for (const field of ["a.id", "a.status", "a.assigned_at", "a.started_at", "a.completed_at", "a.version", "o.category_code", "o.public_summary", "o.city", "o.start_at", "o.end_at", "o.provider_pay_cents", "o.currency"]) {
    assert.ok(assignmentHandler.includes(field), "missing assignment workspace field: " + field);
  }
  assert.ok(assignmentHandler.includes("ORDER BY a.assigned_at DESC"));
  assert.ok(assignmentHandler.includes("LIMIT 100"));
  assert.ok(assignmentHandler.includes("assignments: result.results || []"));
});


const skillsStart = source.indexOf("async function intervenantSkillsRoute(request, env) {");
const skillsEnd = source.indexOf("\nasync function intervenantAssignmentsRoute(", skillsStart);
assert.ok(skillsStart >= 0 && skillsEnd > skillsStart, "skills read route must exist");
const skillsHandler = source.slice(skillsStart, skillsEnd);

test("intervenant skills are exposed through an authenticated GET-only tenant-scoped read model", () => {
  for (const fragment of [
    "request.method !== 'GET'",
    "getSessionUser(request, env)",
    "requireRole(auth, ['intervenant'])",
    "auth.session_active_tenant_id",
    "WHERE user_id = ? AND tenant_id = ?",
    "WHERE tenant_id = ? AND intervenant_id = ?",
    "read_only: true",
    "skills: result.results || []"
  ]) assert.ok(skillsHandler.includes(fragment), "missing skills access guard: " + fragment);
  assert.match(source, /url\.pathname === '\/api\/intervenant\/skills'/);
});

test("skills read model exposes verification status but never evidence hashes or verifier identity", () => {
  assert.match(skillsHandler, /SELECT skill_code, verification_status, verified_at, created_at, updated_at/);
  assert.doesNotMatch(skillsHandler, /evidence_sha256|verified_by_user_id|INSERT INTO|UPDATE\s+intervenant_skills/);
  assert.match(skillsHandler, /SKILLS_SCHEMA_UNAVAILABLE/);
});

test("intervenant tenant membership uses a role allowed by the canonical tenant schema", () => {
  const migration = readFileSync(new URL("../migrations-preview-canonical/0024_tenant_membership_authority.sql", import.meta.url), "utf8");
  assert.match(migration, /role IN \('OWNER', 'ADMIN', 'MANAGER', 'FINANCE', 'OPERATOR', 'SUPPORT', 'MEMBER', 'READ_ONLY'\)/);
  assert.match(source, /requireRole\(membershipAuth, \['intervenant'\]\)/);
  assert.match(source, /tenantRoleAllowed\(membershipContext, \['MEMBER'\]\)/);
  assert.doesNotMatch(source, /membershipContext\.tenant\?\.role[^\n]*intervenant/);
});
