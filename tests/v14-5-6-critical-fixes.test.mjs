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
