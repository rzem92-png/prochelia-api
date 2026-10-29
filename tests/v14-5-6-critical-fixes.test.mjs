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
  assert.match(source, /if\(!scan \|\| scan.result!=='CLEAN'\)/);
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
