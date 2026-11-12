import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");


test("mutations without Origin are denied except exact bootstrap and signed-webhook entry points", () => {
  const policy = source.slice(source.indexOf("function isMutatingMethod"), source.indexOf("async function ensureCommercialRecruitmentSchema"));
  assert.match(policy, /function originlessMutationAllowed/);
  assert.match(policy, /url\.pathname==='\/api\/auth\/bootstrap'/);
  assert.match(policy, /url\.pathname==='\/api\/payments\/webhook'/);
  assert.match(policy, /return !isMutatingMethod\(request\.method\) \|\| originlessMutationAllowed\(request,env\)/);
  assert.match(policy, /if\(!configured\) return false/);
  assert.doesNotMatch(policy, /const defaults=/);
});

test("browser sessions remain HttpOnly cookie-only and are not returned in login JSON", () => {
  assert.match(source, /return getCookie\(request,SESSION_COOKIE\)/);
  assert.doesNotMatch(source, /authorization\.match\(\/\^Bearer\\s\+/);
  assert.match(source, /HttpOnly; Secure; SameSite=Lax/);
  const handler = source.slice(source.indexOf("async function login"), source.indexOf("async function logout"));
  assert.doesNotMatch(handler, /user: safeUser\(user\), token/);
});

test("manual payment finalization cannot mark a transaction paid or refunded without a signed PSP event", () => {
  const handler = source.slice(source.indexOf("async function finalizeMissionPayment"), source.indexOf("async function payoutRequest"));
  assert.match(handler, /PSP_CONFIRMED_OUTCOME_REQUIRED/);
  assert.match(handler, /!\[\x27failed\x27,\x27held\x27\]\.includes\(outcome\)/);
});

test("all support/system authorization helpers reference the real session resolver", () => {
  assert.equal(/\bgetAuth\s*\(/.test(source), false, "undefined getAuth() calls must not remain");
  assert.match(source, /async function supportAuth\(request,env\)[\s\S]*?getSessionUser\(request,env\)/);
});

test("system scale and backup routes require a manager session", () => {
  const routes = source.slice(source.indexOf("const __procheliaNationalHandle = handle"));
  assert.equal((routes.match(/getSessionUser\(request,env\)/g) || []).length >= 3, true);
  assert.match(routes, /!auth\?\.user\|\|String\(auth\.user\.role\|\|''\)\.toUpperCase\(\)!=='GERANTE'/);
});

test("all payment handlers are wired into the active base router with explicit methods", () => {
  const router = source.slice(source.indexOf("async function handleBase(request, env)"));
  const routes = [
    ["/api/payments/onboard", "POST", "paymentOnboard"],
    ["/api/payments/status", "GET", "paymentStatus"],
    ["/api/payments/mission/create", "POST", "createMissionPayment"],
    ["/api/payments/mission/finalize", "POST", "finalizeMissionPayment"],
    ["/api/payments/payout", "POST", "payoutRequest"],
    ["/api/payments/webhook", "POST", "paymentWebhook"],
    ["/api/payments/dispute", "POST", "openPaymentDispute"],
    ["/api/payments/dispute/resolve", "POST", "paymentAdminResolve"]
  ];
  for (const [path, method, handler] of routes) {
    assert.equal(router.includes("'" + path + "': ['" + method + "', " + handler + "]"), true, path + " must be registered");
  }
});

test("mission security preparation is bound to the persisted mission participants", () => {
  const handler = source.slice(source.indexOf("async function securityPrepareMission"), source.indexOf("async function securityPresence"));
  assert.match(handler, /SELECT id,client_id,intervenant_id,status FROM missions WHERE id=\?/);
  assert.match(handler, /MISSION_PARTICIPANTS_MISMATCH/);
  assert.match(handler, /MISSION_NOT_ELIGIBLE_FOR_SECURITY_PREPARATION/);
});

test("mission payment amounts come from the persisted mission and retries remain idempotent", () => {
  const handler = source.slice(source.indexOf("async function createMissionPayment"), source.indexOf("async function finalizeMissionPayment"));
  assert.match(handler, /SELECT id,client_id,intervenant_id,price_client,price_intervenant,commission,status FROM missions/);
  assert.match(handler, /PAYMENT_AMOUNT_MISMATCH_WITH_MISSION/);
  assert.match(handler, /gross-authoritativeCommission!==authoritativeIntervenant/);
  assert.ok(handler.indexOf("idempotent_replay:true") < handler.indexOf("MISSION_ALREADY_HAS_ACTIVE_PAYMENT"));
});

test("non-manager promotion listing exposes only active, current offers for the user's segment", () => {
  const handler = source.slice(source.indexOf("async function promotionList"), source.indexOf("async function activatePromotion"));
  assert.match(handler, /status='ACTIVE'/);
  assert.match(handler, /datetime\(starts_at\)<=CURRENT_TIMESTAMP/);
  assert.match(handler, /datetime\(ends_at\)>=CURRENT_TIMESTAMP/);
  assert.match(handler, /client_type IN \('ALL',\?\)/);
});

test("PSP webhooks are bound to the stored provider and immutable event payload", () => {
  const handler = source.slice(source.indexOf("async function paymentWebhook"), source.indexOf("async function openPaymentDispute"));
  assert.equal((handler.match(/WEBHOOK_PROVIDER_MISMATCH/g) || []).length, 2);
  assert.match(handler, /WEBHOOK_EVENT_ID_PAYLOAD_CONFLICT/);
  assert.match(handler, /const provider=paymentProvider\(env\), payloadProvider=clean\(event\?\.provider\)/);
  assert.match(handler, /if\(payloadProvider && payloadProvider!==provider\).*WEBHOOK_PROVIDER_MISMATCH/);
  assert.match(handler, /prior\?\.payload_hash && prior\.payload_hash!==payloadHash/);
  assert.match(handler, /UPDATE payment_webhook_events SET processed=1,processed_at=CURRENT_TIMESTAMP\\s+WHERE provider=\\? AND event_id=\\? AND changes\\(\\)=1/);
  assert.match(handler, /WEBHOOK_STATE_TRANSITION_NOT_APPLIED/);
  assert.match(handler, /const processed=!!results\.at\(-1\)\?\.meta\?\.changes/);
});

test("wallet ledger protects pending, reserved and paid balances while allowing refund receivables", () => {
  const schema = source.slice(source.indexOf("CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_guard_balances"), source.indexOf("CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_apply"));
  assert.doesNotMatch(schema, /available_cents FROM wallets WHERE user_id=NEW\.user_id\)\+NEW\.available_delta_cents<0/);
  assert.match(schema, /pending_cents FROM wallets WHERE user_id=NEW\.user_id\)\+NEW\.pending_delta_cents<0/);
  assert.match(schema, /reserved_cents FROM wallets WHERE user_id=NEW\.user_id\)\+NEW\.reserved_delta_cents<0/);
  assert.match(schema, /paid_cents FROM wallets WHERE user_id=NEW\.user_id\)\+NEW\.paid_delta_cents<0/);
  assert.match(schema, /PAYMENT_WALLET_NEGATIVE_PROTECTED_BALANCE/);
});

test("PSP webhook bodies are size-bounded before signature work, parsing, or D1 schema writes", () => {
  assert.match(source, /async function readPaymentWebhookBody\(request, maxBytes=65536\)/);
  const handler = source.slice(source.indexOf("async function paymentWebhook"), source.indexOf("async function openPaymentDispute"));
  assert.ok(handler.indexOf("readPaymentWebhookBody(request)") < handler.indexOf("verifyWebhookSignature(request,env,raw)"));
  assert.ok(handler.indexOf("verifyWebhookSignature(request,env,raw)") < handler.indexOf("ensurePaymentSchema(env)"));
  assert.match(handler, /PAYLOAD_TOO_LARGE/);
});

test("confirmed PSP refunds can reverse a payment while its dispute is open", () => {
  const handler = source.slice(source.indexOf("async function paymentWebhook"), source.indexOf("async function openPaymentDispute"));
  assert.match(handler, /txStatus==='refunded'\?"'paid','held'"/);
  assert.match(handler, /const disputeGuard=txStatus==='refunded'\?'':/);
  assert.match(handler, /transitionBindings=txStatus==='refunded'\?\[txStatus,providerPaymentId,txId\]/);
});

test("runtime wallet trigger permits confirmed refund receivables like the SQL migration", () => {
  const schema = source.slice(source.indexOf("CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_guard_balances"), source.indexOf("CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_apply"));
  assert.equal(schema.includes("available_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.available_delta_cents<0"), false);
  assert.equal(schema.includes("pending_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.pending_delta_cents<0"), true);
  assert.equal(schema.includes("reserved_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.reserved_delta_cents<0"), true);
  assert.equal(schema.includes("paid_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.paid_delta_cents<0"), true);
});
