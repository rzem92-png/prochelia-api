import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function pricingQuote(request, env)");
const end = source.indexOf("\nasync function financeSummary(request, env)", start);
assert.ok(start >= 0 && end > start, "pricingQuote handler must exist");
const handler = source.slice(start, end);

test("quote requires a service code and an active server-side tariff", () => {
  assert.match(handler, /SERVICE_CODE_REQUIRED/);
  assert.match(handler, /FROM prestations p/);
  assert.match(handler, /JOIN tarifs t ON t\.prestation_id=p\.id/);
  assert.match(handler, /t\.type='habituel'/);
  assert.match(handler, /ACTIVE_SERVER_TARIFF_NOT_FOUND/);
});

test("base and provider floor are derived from server tariff records", () => {
  assert.match(handler, /Number\(tariff\.client_price\)\*100/);
  assert.match(handler, /Number\(tariff\.intervenant_price\)\*100/);
  assert.doesNotMatch(handler, /b\.base_price_cents/);
  assert.doesNotMatch(handler, /b\.intervenant_floor_cents/);
});

test("phase, commission, discounts and cost assumptions are server-authoritative", () => {
  assert.match(handler, /getSetting\(env,'project_phase','TEST'\)/);
  assert.match(handler, /policy\?\.platform_fee_percent/);
  assert.match(handler, /discountCents:0/);
  assert.doesNotMatch(handler, /b\.platform_fee_percent|b\.discount_cents|b\.psp_percent|b\.software_cost_cents|b\.regulated_max_cents/);
});

test("quote rejects out-of-range distance and duration before pricing", () => {
  assert.match(handler, /distance > 5000/);
  assert.match(handler, /duration < 5 \|\| duration > 1440/);
  assert.match(handler, /INVALID_QUOTE_PARAMETERS/);
});
