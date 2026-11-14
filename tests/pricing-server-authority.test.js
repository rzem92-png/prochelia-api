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
  assert.match(body, /\['GERANTE','ADMIN','FINANCE'\]\.includes\(actorRole\)/);
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

test("quotes require an active server-owned integer-cent tariff", () => {
  assert.match(body, /typeof b\\.tariff_id!=='string'/);
  assert.match(body, /FROM pricing_catalog/);
  assert.match(body, /client_price_cents/);
  assert.match(body, /intervenant_amount_cents/);
  assert.match(body, /APPROVED_TARIFF_NOT_FOUND/);
  assert.doesNotMatch(body, /b\\.base_price_cents/);
  assert.doesNotMatch(body, /b\\.service_code/);
});

test("legacy REAL tariffs are not silently converted", async () => {
  const migration = await readFile(new URL("../migrations/0008_server_owned_pricing_catalog.sql", import.meta.url), "utf8");
  assert.match(migration, /client_price_cents INTEGER NOT NULL/);
  assert.match(migration, /intervenant_amount_cents INTEGER NOT NULL/);
  assert.match(migration, /currency TEXT NOT NULL DEFAULT 'EUR'/);
});
