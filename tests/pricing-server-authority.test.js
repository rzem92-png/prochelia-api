import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function pricingQuote");
const end = source.indexOf("\nasync function financeSummary", start);
const body = source.slice(start, end);

test("pricing phase and customer segment are server-derived", () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(body, /getSetting\(env,'project_phase','TEST'\)/);
  assert.match(body, /actorRole==='ENTREPRISE'\?'B2B':'B2C'/);
  assert.doesNotMatch(body, /b\.phase\s*\|\|/);
  assert.doesNotMatch(body, /b\.client_type\s*\|\|\s*'B2C'/);
});

test("pricing financial levers ignore caller-provided overrides", () => {
  assert.match(body, /policy\?\.platform_fee_percent/);
  assert.match(body, /policy\?\.psp_percent/);
  assert.match(body, /policy\?\.target_margin_percent/);
  assert.match(body, /const discountCents=0/);
  assert.doesNotMatch(body, /b\.platform_fee_percent/);
  assert.doesNotMatch(body, /b\.psp_percent/);
  assert.doesNotMatch(body, /b\.discount_cents/);
  assert.doesNotMatch(body, /b\.regulated_max_cents/);
});

test("pricing validates inputs and approved market bounds", () => {
  assert.match(body, /INVALID_PRICING_INPUT/);
  assert.match(body, /PRICE_BELOW_APPROVED_MARKET_FLOOR/);
  assert.match(body, /PRICE_ABOVE_APPROVED_MARKET_CEILING/);
});
