import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../src/v7-routes.js", import.meta.url), "utf8");

test("sensitive operational routes require an authenticated gerante before dispatch", () => {
  const handleStart = indexSource.indexOf("async function handle(request,env)");
  assert.notEqual(handleStart, -1);
  const handleEnd = indexSource.indexOf("\nexport default", handleStart);
  assert.notEqual(handleEnd, -1);
  const handler = indexSource.slice(handleStart, handleEnd);
  const guard = handler.indexOf("const adminOnlyPaths = new Set([");
  const firstDispatch = handler.indexOf("const fw=await handleFinanceWorkspace");
  assert.ok(guard >= 0 && firstDispatch > guard, "admin gate must run before route dispatch");
  for (const path of [
    "/api/ops/case/execute", "/api/ops/outbox/process", "/api/copilot/briefing",
    "/api/clients/score", "/api/loyalty/update", "/api/quality",
    "/api/capacity/dashboard", "/api/finance/forecast", "/api/system/audit",
    "/api/system/final-audit", "/api/system/production-check",
    "/api/copilot/next-actions", "/api/jobs/process", "/api/ops/dashboard",
    "/api/journal", "/api/cases/approve", "/api/metiers/suggest",
    "/api/settings/phase", "/api/core/schema", "/api/missions/schema"
  ]) assert.ok(handler.includes(path), `missing admin gate for ${path}`);
  assert.match(handler, /routeAuth\.user\.role !== 'gerante'/);
  assert.match(handler, /url\.pathname\.startsWith\('\/api\/strategic\/'\)/);
  assert.match(handler, /url\.pathname\.startsWith\('\/api\/ops\/'\)/);
  assert.match(handler, /error: 'UNAUTHENTICATED'/);
  assert.match(handler, /error: 'FORBIDDEN'/);
});

test("V7 route failures never disclose internal exception messages", () => {
  assert.match(routesSource, /error: "INTERNAL_ERROR"/);
  assert.doesNotMatch(routesSource, /error:\s*error\?\.message/);
});

test("client and provider case creation is bound to the authenticated profile and mission", () => {
  const scopeStart = indexSource.indexOf("async function enforceCaseActorScope");
  const scopeEnd = indexSource.indexOf("async function createOperationalCase", scopeStart);
  assert.ok(scopeStart >= 0 && scopeEnd > scopeStart);
  const scope = indexSource.slice(scopeStart, scopeEnd);
  assert.match(scope, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(scope, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(scope, /WHERE id=\? AND client_id=\?/);
  assert.match(scope, /WHERE id=\? AND intervenant_id=\?/);
  assert.match(scope, /COMPANY_SCOPE_NOT_CONFIGURED/);
  const caseStart = indexSource.indexOf("async function createOperationalCase");
  const caseEnd = indexSource.indexOf("async function getTableColumns", caseStart);
  const handler = indexSource.slice(caseStart, caseEnd);
  assert.ok(handler.indexOf("enforceCaseActorScope") < handler.indexOf("INSERT INTO operational_cases"));
  const complaintStart = indexSource.indexOf("async function complaintCreate");
  const complaintEnd = indexSource.indexOf("\n}", complaintStart);
  const complaint = indexSource.slice(complaintStart, complaintEnd);
  assert.ok(complaint.indexOf("enforceCaseActorScope") < complaint.indexOf("INSERT INTO complaints"));
});

test("frontend directory endpoints exist and expose only manager-scoped directory data", () => {
  const clientsStart = indexSource.indexOf("async function listClients");
  const intervenantsStart = indexSource.indexOf("async function listIntervenants");
  const missionsStart = indexSource.indexOf("async function listMissions");
  const schemaStart = indexSource.indexOf("async function missionsSchema");
  assert.ok(clientsStart >= 0 && intervenantsStart > clientsStart && missionsStart > intervenantsStart && schemaStart > missionsStart);
  const clients = indexSource.slice(clientsStart, intervenantsStart);
  const intervenants = indexSource.slice(intervenantsStart, missionsStart);
  const missions = indexSource.slice(missionsStart, schemaStart);
  assert.match(clients, /requireRole\(auth, \['gerante'\]\)/);
  assert.match(clients, /items:result\.results\|\|\[\]/);
  assert.match(intervenants, /requireRole\(auth, \['gerante'\]\)/);
  assert.match(intervenants, /items:result\.results\|\|\[\]/);
  assert.match(missions, /m\.client_id=\?/);
  assert.match(missions, /m\.intervenant_id=\?/);
  assert.match(missions, /financialColumns = 'm\.price_client'/);
  assert.match(missions, /financialColumns = 'm\.price_intervenant'/);
  assert.match(missions, /role === 'gerante'/);
  assert.match(indexSource, /url\.pathname === '\/api\/clients'/);
  assert.match(indexSource, /url\.pathname === '\/api\/intervenants'/);
  assert.match(indexSource, /url\.pathname === '\/api\/missions' && request\.method === 'GET'/);
});

test("finance workspace uses verified profile IDs and fails closed for unmapped roles", () => {
  const roleStart = indexSource.indexOf("function financeRoleAllowed");
  const rowsStart = indexSource.indexOf("async function financeRowsForUser");
  const rowsEnd = indexSource.indexOf("function financeSummaryFromRows", rowsStart);
  assert.ok(roleStart >= 0 && rowsStart > roleStart && rowsEnd > rowsStart);
  const roleFn = indexSource.slice(roleStart, rowsStart);
  const rowsFn = indexSource.slice(rowsStart, rowsEnd);
  assert.match(roleFn, /\['CLIENT','CLIENT_SOCIAL','INTERVENANT','GERANTE','ADMIN','FINANCE'\]/);
  assert.doesNotMatch(roleFn, /'SUPPORT'|'SOCIETE'|'COMPANY'/);
  assert.match(rowsFn, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(rowsFn, /intervenant_id=\?/);
  assert.match(rowsFn, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(rowsFn, /client_id=\?/);
  assert.match(rowsFn, /FINANCE_ROLE_SCOPE_NOT_CONFIGURED/);
  assert.match(rowsFn, /finance_workspace_entries WHERE user_id=\?/);
  assert.match(rowsFn, /payout_requests WHERE user_id=\?/);
});

test("official finance ledger writes are restricted to finance staff roles", () => {
  const start = indexSource.indexOf("async function financeEntryCreate");
  const end = indexSource.indexOf("async function financeProblemCreate", start);
  assert.ok(start >= 0 && end > start);
  const handler = indexSource.slice(start, end);
  assert.match(handler, /\['GERANTE','ADMIN','FINANCE'\]/);
  assert.match(handler, /FINANCE_LEDGER_WRITE_FORBIDDEN/);
  assert.ok(handler.indexOf("FINANCE_LEDGER_WRITE_FORBIDDEN") < handler.indexOf("INSERT INTO finance_workspace_entries"));
});

test("mission security binds mission participants and uses profile IDs consistently", () => {
  const prepStart = indexSource.indexOf("async function securityPrepareMission");
  const prepEnd = indexSource.indexOf("async function securityPresence", prepStart);
  const presenceStart = prepEnd;
  const verifyStart = indexSource.indexOf("async function securityVerifyCode", presenceStart);
  const resendStart = indexSource.indexOf("async function securityResendCodes", verifyStart);
  assert.ok(prepStart >= 0 && prepEnd > prepStart && verifyStart > presenceStart && resendStart > verifyStart);
  const prep = indexSource.slice(prepStart, prepEnd);
  const presence = indexSource.slice(presenceStart, verifyStart);
  const verify = indexSource.slice(verifyStart, resendStart);
  assert.match(prep, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\?/);
  assert.match(prep, /MISSION_PARTICIPANTS_MISMATCH/);
  assert.match(prep, /SELECT user_id FROM intervenants WHERE id=\?/);
  assert.match(prep, /requireVerifiedIntervenant\(env,providerProfile\.user_id\)/);
  assert.match(presence, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(presence, /mission_security WHERE mission_id=\? AND intervenant_id=\?/);
  assert.doesNotMatch(presence, /intervenant_id=\? LIMIT 1'\)\.bind\(missionId,auth\.user\.id\)/);
  assert.match(verify, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(verify, /mission_security WHERE mission_id=\? AND intervenant_id=\?/);
});

test("client dispute and security resend checks use the client profile ID", () => {
  const resendStart = indexSource.indexOf("async function securityResendCodes");
  const resendEnd = indexSource.indexOf("async function securityClientCode", resendStart);
  const disputeStart = indexSource.indexOf("async function openPaymentDispute");
  const disputeEnd = indexSource.indexOf("async function paymentAdminResolve", disputeStart);
  assert.ok(resendStart >= 0 && resendEnd > resendStart && disputeStart >= 0 && disputeEnd > disputeStart);
  const resend = indexSource.slice(resendStart, resendEnd);
  const dispute = indexSource.slice(disputeStart, disputeEnd);
  assert.match(resend, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(resend, /String\(sec\.client_id\)!==String\(clientProfile\.id\)/);
  assert.match(dispute, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(dispute, /String\(tx\.client_id\)!==String\(clientProfile\.id\)/);
});

test("public service catalogue excludes inactive and internal fields", () => {
  const start = indexSource.indexOf("async function getPrestations");
  const end = indexSource.indexOf("async function health", start);
  assert.ok(start >= 0 && end > start);
  const handler = indexSource.slice(start, end);
  assert.match(handler, /SELECT id,name,description FROM prestations WHERE active=1/);
  assert.doesNotMatch(handler, /SELECT \* FROM prestations/);
});

test("finance dashboard and exports redact margin and counterparty fields by role", () => {
  const rowsStart = indexSource.indexOf("function financePublicPaymentRows");
  const summaryStart = indexSource.indexOf("function financePublicSummary", rowsStart);
  const solutionStart = indexSource.indexOf("function financeProblemSolution", summaryStart);
  const dashboardStart = indexSource.indexOf("async function financeDashboard");
  const exportStart = indexSource.indexOf("async function financeExport", dashboardStart);
  const entryStart = indexSource.indexOf("async function financeEntryCreate", exportStart);
  assert.ok(rowsStart >= 0 && summaryStart > rowsStart && solutionStart > summaryStart);
  assert.ok(dashboardStart >= 0 && exportStart > dashboardStart && entryStart > exportStart);
  const rowView = indexSource.slice(rowsStart, summaryStart);
  const summaryView = indexSource.slice(summaryStart, solutionStart);
  const dashboard = indexSource.slice(dashboardStart, exportStart);
  const exportHandler = indexSource.slice(exportStart, entryStart);
  assert.match(rowView, /role==='CLIENT'\|\|role==='CLIENT_SOCIAL'/);
  assert.match(rowView, /net_intervenant_cents:x\.net_intervenant_cents/);
  assert.doesNotMatch(rowView, /provider_payment_id/);
  assert.match(summaryView, /platform_net_cents/);
  assert.match(summaryView, /net_intervenant_eur/);
  assert.match(dashboard, /financePublicSummary\(/);
  assert.match(dashboard, /financePublicPaymentRows\(/);
  assert.match(exportHandler, /role==='INTERVENANT'/);
  assert.match(exportHandler, /Votre rémunération EUR/);
  assert.match(exportHandler, /const header=/);
  assert.match(exportHandler, /role==='CLIENT'\|\|role==='CLIENT_SOCIAL'/);
});
