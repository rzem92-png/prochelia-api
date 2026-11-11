import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
function handler(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing handler ${name}`);
  const next = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

test("mission security derives client and provider from the canonical mission", () => {
  const h = handler("securityPrepareMission");
  assert.match(h, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\? LIMIT 1/);
  assert.match(h, /MISSION_PARTY_MISMATCH/);
  assert.match(h, /const clientId=String\(mission\.client_id\), intervenantId=String\(mission\.intervenant_id\)/);
  assert.match(h, /requireVerifiedIntervenant\(env,intervenantId\)/);
});

test("mission payment binds parties to mission and validates positive bounded amounts", () => {
  const h = handler("createMissionPayment");
  assert.match(h, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\? LIMIT 1/);
  assert.match(h, /MISSION_PARTY_MISMATCH/);
  assert.match(h, /gross<=0\|\|commission<0\|\|commission>gross/);
  assert.match(h, /const clientId=String\(mission\.client_id\), intervenantId=String\(mission\.intervenant_id\)/);
});

test("client payment disputes require ownership and cannot exceed paid transaction gross", () => {
  const h = handler("openPaymentDispute");
  assert.match(h, /SELECT id FROM clients WHERE user_id=\? LIMIT 1/);
  assert.match(h, /String\(tx\.client_id\)!==String\(own\.id\)/);
  assert.match(h, /amount>Number\(tx\.gross_cents\|\|0\)/);
  assert.match(h, /mission_id=\? AND status='paid'/);
  assert.match(h, /String\(auth\.user\.role\|\|'\'\)\.toUpperCase\(\)==='CLIENT'/);
  assert.match(h, /readJsonLimited\(request,8192\)/);
  assert.match(h, /status='paid' ORDER BY created_at DESC LIMIT 1/);
  assert.match(h, /PAYMENT_STATE_CONFLICT/);
  assert.match(h, /PAYMENT_DISPUTE:\\$\{id\}/);
});

test("manual finance actions cannot fabricate PSP settlement or refund", () => {
  const finalize = handler("finalizeMissionPayment");
  assert.match(finalize, /PSP_SERVER_CONFIRMATION_REQUIRED/);
  assert.match(finalize, /if\(\['paid','refunded'\]\.includes\(outcome\)\)/);
  const resolve = handler("paymentAdminResolve");
  assert.match(resolve, /status='resolution_pending'/);
  assert.match(resolve, /financial_status_unchanged:true/);
  assert.doesNotMatch(resolve, /SET status=\?,updated_at=CURRENT_TIMESTAMP WHERE id=\?/);
});

test("verified PSP webhook resolves provider profile to its user before crediting wallet", () => {
  const webhook = handler("paymentWebhook");
  assert.match(webhook, /SELECT user_id FROM intervenants WHERE id=\? LIMIT 1/);
  assert.match(webhook, /bind\(providerProfile\.user_id\)/);
  assert.match(webhook, /SELECT \* FROM wallets WHERE user_id=\? LIMIT 1/);
  assert.match(webhook, /bind\(providerProfile\.user_id\)\.first\(\)/);
});

test("PSP account identifiers cannot be forged from the browser during onboarding", () => {
  const onboard = handler("paymentOnboard");
  assert.match(onboard, /const accountId = null/);
  assert.match(onboard, /server-side PSP/);
  assert.doesNotMatch(onboard, /clean\(body\?\.provider_account_id\)/);
});

test("loyalty adjustments validate owner, points, amount and event type", () => {
  const h = handler("loyaltyUpdate");
  assert.match(h, /EXACTLY_ONE_LOYALTY_OWNER_REQUIRED/);
  assert.match(h, /Number\.isInteger\(Number\(b\.points\)\)/);
  assert.match(h, /Number\.isSafeInteger\(amountCents\)/);
  assert.match(h, /SELECT id FROM clients WHERE id=\? LIMIT 1/);
  assert.match(h, /SELECT id FROM business_profiles WHERE id=\? LIMIT 1/);
  assert.match(h, /INVALID_EVENT_TYPE/);
});


test("mission payment idempotency keys cannot replay a different mission or amount", () => {
  const h = handler("createMissionPayment");
  assert.match(h, /old\.type\)===\x27MISSION_CHARGE\x27/);
  assert.match(h, /old\.mission_id\)===missionId/);
  assert.match(h, /old\.client_id\)===clientId/);
  assert.match(h, /old\.intervenant_id\)===intervenantId/);
  assert.match(h, /Number\(old\.gross_cents\)===gross/);
  assert.match(h, /Number\(old\.commission_cents\)===commission/);
  assert.match(h, /IDEMPOTENCY_KEY_REUSED/);
});

test("finance payment history maps auth users to profile IDs and fails closed for unknown roles", () => {
  const h = source.slice(source.indexOf("async function financeRowsForUser("), source.indexOf("\nfunction financeSummaryFromRows"));
  assert.match(h, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(h, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(h, /where = '1=0'/);
});

test("manual finance entries enforce bounded integer cents and strict enums", () => {
  const h = handler("financeEntryCreate");
  assert.match(h, /readJsonLimited\(request,8192\)/);
  assert.match(h, /Number\.isSafeInteger\(amount\)/);
  assert.match(h, /allowedTypes\.has\(entryType\)/);
  assert.match(h, /!\['IN','OUT'\]\.includes\(direction\)/);
  assert.match(h, /currency!=='EUR'/);
});
