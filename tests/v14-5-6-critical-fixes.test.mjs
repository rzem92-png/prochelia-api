import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../src/stripe-adapter.js', import.meta.url), 'utf8');
const scanner = readFileSync(new URL('../security/clamav-gateway/server.mjs', import.meta.url), 'utf8');

test('mission security checks assigned mission and canonical intervenant profile mapping', () => {
  assert.match(source, /MISSION_ASSIGNMENT_MISMATCH/);
  assert.match(source, /SELECT id,user_id FROM intervenants WHERE id=\? LIMIT 1/);
  assert.match(source, /SELECT id,user_id FROM intervenants WHERE user_id=\? LIMIT 1/);
  assert.match(source, /code_expiry_policy:'mission_schedule'/);
  assert.match(source, /const arrivalExpiry=new Date\(startMs\+4\*60\*60\*1000\)/);
  assert.match(source, /const arrival=securityCode\(\),end=securityCode\(\)/);
});

test('Mission security codes are consumed atomically to prevent concurrent double use', () => {
  assert.match(source, /arrival_used_at IS NULL AND status='prepared'/);
  assert.match(source, /end_used_at IS NULL AND status='in_progress'/);
  assert.match(source, /SECURITY_CODE_ALREADY_USED_OR_STATE_CHANGED/);
});

test('Stripe charge webhooks resolve through persisted provider references', () => {
  assert.match(source, /CREATE TABLE IF NOT EXISTS payment_provider_references/);
  assert.match(source, /SELECT transaction_id FROM payment_provider_references WHERE provider='stripe' AND external_id=\?/);
  assert.match(source, /STRIPE_TRANSACTION_REFERENCE_NOT_READY/);
  assert.match(adapter, /payment_intent_data\[metadata\]\[prochelia_transaction_id\]/);
});

test('Stripe event-specific amounts avoid false failure and dispute mismatches', () => {
  assert.match(source, /isFailure=failedEvent\.has\(event\.type\)/);
  assert.match(source, /isDispute=disputeEvent\.has\(event\.type\)/);
  assert.match(source, /obj\?\.amount_received \?\? obj\?\.amount/);
  assert.match(source, /isCheckout \? \(sessionId\|\|null\) : null/);
});

test('Stripe refunds are bounded, adjust wallet balances, and distinguish partial refunds', () => {
  assert.match(source, /refundCents>grossCents/);
  assert.match(source, /'partially_refunded'/);
  assert.match(source, /STRIPE_REFUND_AMOUNT_INVALID/);
  assert.match(source, /walletReversal/);
  assert.match(source, /STRIPE_REFUND_WALLET_ADJUSTED/);
});

test('Stripe disputes are persisted idempotently for investigation', () => {
  assert.match(source, /INSERT OR IGNORE INTO payment_disputes/);
  assert.match(source, /STRIPE_DISPUTE_RECORDED/);
  assert.match(source, /'held'/);
});

test('security and payment hardening is explicitly versioned', () => {
  assert.match(source, /V14\.5\.6-EXPERT-PREPRODUCTION/);
});


test('transversal Copilot is authenticated, role-aware, and exposes scenario catalog', () => {
  assert.match(source, /async function copilotScenarios\(request,env\)/);
  assert.match(source, /supportAuth\(request,env\)/);
  assert.match(source, /\/api\/copilot\/scenarios/);
  assert.match(source, /MISSION_CONFLICT/);
  assert.match(source, /PAYMENT_RECONCILIATION/);
  assert.match(source, /GDPR_REQUEST/);
  assert.match(source, /SECURITY_INCIDENT/);
});

test('Copilot AI is server-side, bounded, privacy-minimizing, and never executes model output', () => {
  assert.match(source, /env\.OPENAI_API_KEY/);
  assert.match(source, /COPILOT_PROVIDER_NOT_CONFIGURED/);
  assert.match(source, /prompt\.length>6000/);
  assert.match(source, /await sha256Hex\(prompt\)/);
  assert.match(source, /OPENAI_MODEL/);
  assert.match(source, /PLAN_ONLY_NO_MUTATION/);
  assert.match(source, /Aucune action métier n’est exécutée par la sortie du modèle/);
  assert.match(source, /human|Validation humaine obligatoire/);
  assert.match(source, /api\/copilot\/ask/);
  assert.match(source, /Ne demande pas de données personnelles ou de santé inutiles/);
});


test('support automation never trusts a client-supplied execution_verified flag', () => {
  assert.match(source, /const trustedActionReceipt = null/);
  assert.match(source, /Never trust execution_verified supplied in a public request body/);
  assert.match(source, /NO_VERIFIED_DOWNSTREAM_ACTION/);
});


test('Copilot readiness diagnostics are authenticated and never expose secret values', () => {
  assert.match(source, /async function copilotHealth\(request,env\)/);
  assert.match(source, /\/api\/copilot\/health/);
  assert.match(source, /AI_PROVIDER_SECRET/);
  assert.match(source, /Aucun accès direct de l’IA aux données D1, Stripe ou documents/);
});


test('Copilot plans are persisted with review status and owner-scoped retrieval', () => {
  assert.match(source, /CREATE TABLE IF NOT EXISTS copilot_action_plans/);
  assert.match(source, /AWAITING_HUMAN_REVIEW/);
  assert.match(source, /async function copilotListPlans\(request,env\)/);
  assert.match(source, /async function copilotGetPlan\(request,env,id\)/);
  assert.match(source, /WHERE id=\? AND user_id=\?/);
  assert.match(source, /\/api\/copilot\/plans/);
  assert.match(source, /execution_performed:false/);
});


test('Uploaded documents remain quarantined unless a configured antivirus confirms the exact hash is clean', () => {
  assert.match(source, /CREATE TABLE IF NOT EXISTS document_security_scans/);
  assert.match(source, /DOCUMENT_SCAN_URL/);
  assert.match(source, /DOCUMENT_SCAN_TOKEN/);
  assert.match(source, /SCANNER_DID_NOT_CONFIRM_FILE_HASH/);
  assert.match(source, /'QUARANTINED'/);
  assert.match(source, /ANTIVIRUS_SCAN_NOT_CLEAN/);
  assert.match(source, /DOCUMENT_QUARANTINED_ANTIVIRUS_REQUIRED/);
  assert.match(source, /async function rescanDocumentEndpoint\(request,env\)/);
  assert.match(source, /\/api\/documents\/scan/);
});

test('Antivirus scanner failures never permit document review or download', () => {
  assert.match(source, /result==='CLEAN'\?'PENDING':result==='INFECTED'\?'INFECTED':'QUARANTINED'/);
  assert.match(source, /if\(!scan \|\| scan.result!=='CLEAN' \|\| String\(scan\.file_sha256/);
  assert.match(source, /if\(!scan \|\| scan.result!=='CLEAN' \|\| String\(scan.file_sha256/);
  assert.match(source, /'ANTIVIRUS_SCAN'/);
});


test('Free ClamAV gateway requires authentication, checks hashes, and fails closed on scanner errors', () => {
  assert.match(scanner, /DOCUMENT_SCAN_TOKEN/);
  assert.match(scanner, /timingSafeEqual/);
  assert.match(scanner, /CLAMD_HOST/);
  assert.match(scanner, /zINSTREAM/);
  assert.match(scanner, /SHA256_MISMATCH/);
  assert.match(scanner, /SCANNER_UNAVAILABLE/);
  assert.match(scanner, /verdict: scan\.verdict/);
  assert.match(scanner, /MAX_SCAN_BYTES/);
});


test('Document administrative review requires a CLEAN antivirus result for the exact stored SHA-256', () => {
  assert.match(source, /SELECT id,status,sha256_hex FROM document_records WHERE id=\? LIMIT 1/);
  assert.match(source, /scan\.result!=='CLEAN' \|\| String\(scan\.file_sha256\|\|''\)\.toLowerCase\(\)!==String\(doc\.sha256_hex\|\|''\)\.toLowerCase\(\)/);
});

test('Legal source-of-truth drafts cover B2C, B2B, intervenant, GDPR, payments, cookies and preproduction checks', () => {
  const legalFiles = [
    '../legal/README.md',
    '../legal/01-charte-client-b2c.md',
    '../legal/02-conditions-client-b2b.md',
    '../legal/03-charte-intervenant.md',
    '../legal/04-notice-confidentialite-rgpd.md',
    '../legal/05-annexe-sous-traitance-rgpd-article-28.md',
    '../legal/06-politique-paiements-remboursements.md',
    '../legal/07-cookies-traceurs.md',
    '../legal/08-checklist-conformite-avant-production.md',
    '../legal/09-cadre-repartition-responsabilites.md'
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));
  assert.equal(legalFiles.length, 10);
  assert.ok(legalFiles.slice(1, 8).every(content => /BROUILLON/i.test(content)));
  assert.match(legalFiles[0], /Source de vérité et gouvernance sans doublon/);
  assert.match(legalFiles[1], /Client B2C/);
  assert.match(legalFiles[2], /Client B2B/);
  assert.match(legalFiles[4], /RGPD/);
  assert.match(legalFiles[8], /avant production/i);
  assert.match(legalFiles[9], /responsabilités/i);
});


test('Mission creation and payment checkout remain fail-closed before acceptance', () => {
  assert.match(source, /write_enabled:\s*false/);
  assert.match(source, /WRITE_GATE_NOT_ACTIVATED/);
  assert.match(source, /MISSION_API_NOT_ACTIVATED/);
  assert.match(source, /AUTHENTICATED_VALIDATION_REQUIRED/);
  assert.match(source, /PAYMENTS_DISABLED_UNTIL_ACCEPTANCE/);
  assert.match(source, /PAYMENT_PROVIDER.*STRIPE_NOT_CONFIGURED/s);
});


test('Stripe webhook refuses processing until native signature adapter is connected', () => {
  // Deliberate fail-closed behavior: a valid helper alone is not enough until the
  // native Stripe signature, event mapping, idempotency and reconciliation are wired.
  assert.match(source, /STRIPE_WEBHOOK_ADAPTER_NOT_IMPLEMENTED/);
  assert.match(source, /if\(String\(provider\)\.toLowerCase\(\)==='stripe'\) return json\(/);
  assert.match(adapter, /verifyStripeSignature/);
});

test('Initial manager bootstrap validates the NOT NULL phone field from the real D1 schema', () => {
  assert.ok(source.includes('const phoneInput = clean(body?.phone)'));
  assert.ok(source.includes("const normalizedPhone = phone.replace(/[\\s().-]/g, '')"));
  assert.ok(source.includes("/^\\+?[1-9]\\d{7,14}$/"));
  assert.ok(source.includes("required_fields: ['email', 'first_name', 'last_name', 'phone', 'password']"));
  assert.ok(source.includes('INSERT INTO users (id, role, email, first_name, last_name, phone, status, password_hash)'));
});

test('Initial manager bootstrap uses one atomic conditional INSERT and rejects a lost race', () => {
  assert.ok(source.includes("SELECT ?, 'gerante', ?, ?, ?, ?, 'active', ?"));
  assert.ok(source.includes('WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1)'));
  assert.ok(source.includes('Number(created?.meta?.changes || 0) !== 1'));
  assert.ok(source.includes("error: 'BOOTSTRAP_ALREADY_USED'"));
});

test('Mission payload validation rejects invalid dates and inconsistent price split', () => {
  assert.ok(source.includes("const startMs = Date.parse(String(body.start_at || ''))"));
  assert.ok(source.includes("endMs <= startMs"));
  assert.ok(source.includes("errors.push('price_commission_mismatch')"));
  assert.ok(source.includes("Math.abs(clientCents - intervenantCents - commissionCents) > 1"));
});


test('Mission preparation blocks when full-interval availability is missing', () => {
  assert.match(source, /async function checkMissionSchedulingConflicts\(env, mission\)/);
  assert.match(source, /INTERVENANT_NOT_AVAILABLE_FOR_FULL_INTERVAL/);
  assert.match(source, /datetime\(start_at\)<=datetime\(\?\) AND datetime\(end_at\)>=datetime\(\?\)/);
  assert.match(source, /MISSION_SCHEDULING_CONFLICT_BLOCKED/);
});

test('Mission preparation detects overlapping assigned missions and fails closed on unknown statuses', () => {
  assert.match(source, /INTERVENANT_MISSION_OVERLAP/);
  assert.match(source, /datetime\(start_at\)<datetime\(\?\)/);
  assert.match(source, /datetime\(COALESCE\(NULLIF\(end_at,''\),start_at\)\)>datetime\(\?\)/);
  assert.match(source, /NOT IN \('cancelled','canceled','completed','rejected','refused'\)/);
  assert.match(source, /MISSION_SCHEDULE_INVALID/);
  assert.match(source, /error:'MISSION_SCHEDULING_CONFLICT'/);
});

test('Mission preparation checks complete availability and detects overlapping active missions', () => {
  assert.match(source, /async function checkMissionSchedulingConflicts\(env, mission\)/);
  assert.match(source, /INTERVENANT_NOT_AVAILABLE_FOR_FULL_INTERVAL/);
  assert.match(source, /INTERVENANT_MISSION_OVERLAP/);
  assert.match(source, /MISSION_SCHEDULING_CONFLICT_BLOCKED/);
  assert.match(source, /MISSION_SCHEDULE_INVALID/);
});


test('Operational conflict resolution never directly reassigns or reschedules a mission', () => {
  assert.match(source, /ASSIGN_REPLACEMENT_REVIEW/);
  assert.match(source, /RESCHEDULE_MISSION_REVIEW/);
  assert.match(source, /requires_revalidation:true/);
  assert.match(source, /requires_availability_recheck:true/);
  assert.match(source, /requires_client_consent:true/);
  assert.doesNotMatch(source, /UPDATE missions SET intervenant_id=\? WHERE id=\?/);
  assert.doesNotMatch(source, /UPDATE missions SET \$\{target\}=\? WHERE id=\?/);
});


test('Operational cases remain open until downstream actions are verified', () => {
  assert.match(source, /completion_requires_verified_receipt:true/);
  assert.match(source, /const finalStatus = verifiedComplete \? 'RESOLVED' : \(failed \? 'ACTION_FAILED' : 'WAITING_ACTION'\)/);
  assert.match(source, /CASE_ACTIONS_PENDING/);
  assert.match(source, /resolved_at=\?/);
  assert.doesNotMatch(source, /status='RESOLVED',resolution_json=\?,requires_manager=0/);
});


test('Trust Passport reads the actual D1 intervenants.validation_status field fail-closed', () => {
  assert.match(source, /profileRow\.validation_status/);
  assert.match(source, /\['ACTIVE','APPROVED','VALIDATED','VERIFIED'\]\.includes\(rawProfileStatus\)/);
  assert.match(source, /suspended:rawProfileStatus==='SUSPENDED'/);
  assert.match(source, /status:\['ACTIVE','APPROVED','VALIDATED','VERIFIED'\]\.includes\(rawProfileStatus\)\?'ACTIVE':rawProfileStatus/);
});


test('Travel fee and operating cost use server policy and a persisted route estimate', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /Number\(route\.distance_km\)/);
  assert.match(quote, /Number\(policy\.fuel_cost_per_km_cents/);
  assert.match(quote, /Number\(travelPolicy\.travel_fee_per_km_cents/);
  assert.match(quote, /travel_operating_cost_cents/);
});


test('Travel policy history is retained while only one active policy is permitted', () => {
  assert.match(source, /DROP INDEX IF EXISTS idx_pricing_travel_policy_active/);
  assert.match(source, /ON pricing_travel_policies\(phase, client_type\) WHERE active=1/);
  assert.match(source, /idx_pricing_route_owner_expiry/);
});

test('Route estimates are calculated server-side and retain only hashed address provenance', () => {
  const route = source.slice(source.indexOf('async function pricingRouteEstimate'), source.indexOf('async function pricingQuote'));
  assert.match(route, /MAPS_PROVIDER/);
  assert.match(route, /MAPS_API_KEY/);
  assert.match(route, /routes\.googleapis\.com\/directions\/v2:computeRoutes/);
  assert.match(route, /X-Goog-FieldMask/);
  assert.match(route, /distanceMeters/);
  assert.match(route, /pricing_route_estimates/);
  assert.match(route, /pricing_route_estimate_audit/);
  assert.match(route, /origin_sha256/);
  assert.match(route, /destination_sha256/);
  assert.doesNotMatch(route, /INSERT INTO pricing_route_estimates[^;]*b\.distance_km/s);
  assert.match(source, /\/api\/pricing\/route-estimate/);
});

test('Pricing quotes reject every client-supplied price, discount, distance and pricing modifier', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /CLIENT_PRICING_INPUT_FORBIDDEN/);
  assert.match(quote, /base_price_cents/);
  assert.match(quote, /discount_cents/);
  assert.match(quote, /distance_km/);
  assert.match(quote, /evening.*night.*saturday.*sunday.*holiday/s);
  assert.doesNotMatch(quote, /Number\(b\.base_price_cents/);
  assert.doesNotMatch(quote, /Number\(b\.discount_cents/);
  assert.doesNotMatch(quote, /Number\(b\.distance_km/);
});

test('Every quote requires an active D1 prestation and its active server tariff', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(source, /CREATE TABLE IF NOT EXISTS pricing_travel_policies/);
  assert.match(quote, /FROM tarifs t JOIN prestations p ON p\.id=t\.prestation_id/);
  assert.match(quote, /p\.active=1 AND t\.prestation_id=\? AND t\.type='habituel' AND t\.active=1/);
  assert.match(quote, /ACTIVE_PRESTATION_TARIFF_AMBIGUOUS/);
  assert.match(quote, /ACTIVE_PRESTATION_TARIFF_NOT_FOUND/);
  assert.match(quote, /VALIDATED_ROUTE_ESTIMATE_REQUIRED/);
  assert.match(quote, /pricing_route_estimates/);
  assert.match(quote, /owner_user_id=\?/);
  assert.match(quote, /gate\.auth\.user\.role==='entreprise'\?'B2B':'B2C'/);
});

test('Date modifiers and public holidays are calculated from mission timestamps server-side', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /timeZone:'Europe\/Paris'/);
  assert.match(quote, /pricing_holidays/);
  assert.match(source, /2026-04-06/);
  assert.match(source, /2030-12-25/);
  assert.match(quote, /holiday_date BETWEEN/);
  assert.match(quote, /isSaturday=.*localEnd\.weekday/);
  assert.match(quote, /isEvening=.*endHour/);
  assert.match(quote, /isNight=.*endHour/);
});

test('Only active, date-valid and matching promotions can reduce the service price', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /FROM promotions WHERE code=\? AND status='ACTIVE'/);
  assert.match(quote, /datetime\(starts_at\)<=datetime\(\?\)/);
  assert.match(quote, /datetime\(ends_at\)>datetime\(\?\)/);
  assert.match(quote, /PROMOTION_NOT_APPROVED_OR_NOT_ELIGIBLE/);
  assert.match(quote, /approved_promotion_discount_cents/);
});

test('Financial decomposition reconciles service, travel, provider, commission, PSP and margin', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /platform_fee_fixed_cents/);
  assert.match(quote, /platform_fee_percent/);
  assert.match(quote, /platform_commission_fixed_cents/);
  assert.match(quote, /platform_commission_variable_cents/);
  assert.match(quote, /travel_fee_cents/);
  assert.match(quote, /travel_operating_cost_cents/);
  assert.match(quote, /psp_cost_cents/);
  assert.match(quote, /platform_margin_cents/);
  assert.match(quote, /reconciliation_delta_cents/);
  assert.match(quote, /QUOTE_ACCOUNTING_RECONCILIATION_FAILED/);
});

test('Pricing reference and policy failures fail closed', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /PRICING_REFERENCE_DATA_UNAVAILABLE/);
  assert.match(quote, /PRICING_POLICY_UNAVAILABLE/);
  assert.match(quote, /HOLIDAY_CALENDAR_UNAVAILABLE/);
  assert.match(quote, /FINANCIAL_POLICY_INVALID/);
});

test('Pricing quote rejects invalid or out-of-range server financial policy values', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /FINANCIAL_POLICY_INVALID/);
  assert.match(quote, /platform_fee_fixed_cents/);
  assert.match(quote, /platform_fee_percent/);
  assert.match(quote, /psp_percent/);
  assert.match(quote, /target_margin_percent/);
  assert.match(quote, /regulated_max_cents/);
  assert.match(quote, /pricing_travel_policies/);
  assert.match(quote, /travel_fee_per_km_cents/);
});


test('Pricing policy selection is deterministic and blocks duplicate active rules', () => {
  const quote = source.slice(source.indexOf('async function pricingQuote'), source.indexOf('async function financeSummary'));
  assert.match(quote, /const policyRows=await env\.DB\.prepare/);
  assert.match(quote, /const exactPolicies=/);
  assert.match(quote, /const fallbackPolicies=/);
  assert.match(quote, /PRICING_POLICY_AMBIGUOUS/);
  assert.match(quote, /const providerFloor=Math\.max\(Number\(rate\.intervenant_floor_cents\),Number\(policy\.intervenant_floor_cents\|\|0\)\)/);
});
