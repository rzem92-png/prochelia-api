import test from "node:test";
import assert from "node:assert/strict";
import { resolvePricingAuthority } from "../src/index.js";

const policy = {
  market_min_cents: 5000,
  market_max_cents: 12000,
  platform_fee_percent: 18,
  psp_percent: 1.5,
  psp_fixed_cents: 25,
  software_cost_cents: 40,
  target_margin_percent: 14,
  intervenant_floor_cents: 4200,
  client_ceiling_cents: 13000
};
const settings = {
  fuel_cost_per_km_cents: 22,
  fuel_reference_price_cents_litre_normal: 175,
  fuel_reference_price_cents_litre_high: 205,
  software_monthly_cost_cents: 0,
  default_margin_percent: 12
};

test("client cannot override phase, commission, PSP fees, margin, discount, floor or ceiling", () => {
  const result = resolvePricingAuthority({
    role: "client",
    projectPhase: "PREVIEW",
    policy,
    settings,
    body: {
      base_price_cents: 8000, client_type: "B2B", phase: "PRODUCTION",
      platform_fee_percent: 0, psp_percent: 0, psp_fixed_cents: 0,
      target_margin_percent: 0, discount_cents: 7000,
      intervenant_floor_cents: 1, regulated_max_cents: 1,
      software_cost_cents: 0, fuel_price_cents_per_litre: 1
    }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.inputs.phase, "PREVIEW");
  assert.equal(result.inputs.clientType, "B2C");
  assert.equal(result.inputs.commissionRate, 0.18);
  assert.equal(result.inputs.pspPercent, 1.5);
  assert.equal(result.inputs.pspFixed, 25);
  assert.equal(result.inputs.targetMargin, 14);
  assert.equal(result.inputs.discountCents, 0);
  assert.equal(result.inputs.intervenantFloor, 4200);
  assert.equal(result.inputs.regulatedMax, 13000);
  assert.equal(result.inputs.software, 40);
  assert.equal(result.inputs.fuelPriceCentsPerLitre, 175);
});

test("enterprise quotes are forced to B2B regardless of browser input", () => {
  const result = resolvePricingAuthority({
    role: "entreprise", projectPhase: "TEST", policy, settings,
    body: { base_price_cents: 8000, client_type: "B2C" }
  });
  assert.equal(result.inputs.clientType, "B2B");
});

test("non-manager quotes fail closed without a bounded server policy", () => {
  assert.equal(resolvePricingAuthority({
    role: "client", body: { base_price_cents: 8000 }, projectPhase: "TEST", settings
  }).error, "PRICING_POLICY_REQUIRED");
});

test("non-manager cannot quote outside server policy bounds", () => {
  assert.equal(resolvePricingAuthority({
    role: "client", body: { base_price_cents: 13000 }, policy, projectPhase: "TEST", settings
  }).error, "PRICE_OUTSIDE_POLICY");
});

test("invalid monetary amounts and extreme distances are rejected", () => {
  assert.equal(resolvePricingAuthority({
    role: "client", body: { base_price_cents: 8000.5 }, policy, projectPhase: "TEST", settings
  }).error, "BASE_PRICE_INVALID");
  assert.equal(resolvePricingAuthority({
    role: "client", body: { base_price_cents: 8000, distance_km: 501 }, policy, projectPhase: "TEST", settings
  }).error, "QUOTE_INPUT_OUT_OF_RANGE");
});

test("manager may deliberately override a draft quote while phase remains server controlled", () => {
  const result = resolvePricingAuthority({
    role: "gerante", projectPhase: "TEST", settings,
    body: {
      base_price_cents: 8000, phase: "PRODUCTION", client_type: "B2C",
      platform_fee_percent: 12, psp_percent: 2, psp_fixed_cents: 30,
      target_margin_percent: 20, discount_cents: 100,
      intervenant_floor_cents: 5000, regulated_max_cents: 10000,
      software_cost_cents: 50
    }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.inputs.phase, "TEST");
  assert.equal(result.inputs.commissionRate, 0.12);
  assert.equal(result.inputs.pspPercent, 2);
  assert.equal(result.inputs.pspFixed, 30);
  assert.equal(result.inputs.targetMargin, 20);
  assert.equal(result.inputs.discountCents, 100);
});
