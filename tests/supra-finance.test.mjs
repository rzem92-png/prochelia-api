import test from "node:test";
import assert from "node:assert/strict";
import { calculateSupraQuote } from "../src/supra-finance.js";

test("calculates commission and contribution in integer minor units", () => {
  const result = calculateSupraQuote({
    grossAmountMinor: 10000,
    commissionBps: 1500,
    paymentFeeMinor: 250,
    operatingCostMinor: 100,
    currency: "EUR"
  });
  assert.equal(result.commissionAmountMinor, 1500);
  assert.equal(result.providerNetAmountMinor, 8500);
  assert.equal(result.platformContributionMinor, 1150);
  assert.equal(result.contributionPositive, true);
  assert.equal(result.createsFinancialObligation, false);
});

test("uses deterministic half-up rounding for a one-cent boundary", () => {
  const result = calculateSupraQuote({
    grossAmountMinor: 1,
    commissionBps: 5000,
    currency: "EUR"
  });
  assert.equal(result.commissionAmountMinor, 1);
  assert.equal(result.providerNetAmountMinor, 0);
});

test("flags a negative platform contribution instead of hiding it", () => {
  const result = calculateSupraQuote({
    grossAmountMinor: 1000,
    commissionBps: 500,
    paymentFeeMinor: 100,
    operatingCostMinor: 100,
    currency: "EUR"
  });
  assert.equal(result.platformContributionMinor, -150);
  assert.equal(result.contributionNegative, true);
});

test("rejects floating point amounts, invalid rates and currencies", () => {
  assert.throws(() => calculateSupraQuote({
    grossAmountMinor: 10.5, commissionBps: 100, currency: "EUR"
  }), /grossAmountMinor/);
  assert.throws(() => calculateSupraQuote({
    grossAmountMinor: 100, commissionBps: 100.5, currency: "EUR"
  }), /commissionBps/);
  assert.throws(() => calculateSupraQuote({
    grossAmountMinor: 100, commissionBps: 100, currency: "EURO"
  }), /currency/);
});

test("rejects commission above 100 percent", () => {
  assert.throws(() => calculateSupraQuote({
    grossAmountMinor: 100, commissionBps: 10001, currency: "EUR"
  }), /commissionBps/);
});

import { handleV7Route } from "../src/v7-routes.js";

test("quote-preview rejects unauthenticated callers", async () => {
  const request = new Request("https://example.test/api/v7/finance/quote-preview", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ grossAmountMinor: 10000, commissionBps: 1500, currency: "EUR" })
  });
  const response = await handleV7Route(request, {}, "/api/v7/finance/quote-preview", null);
  assert.equal(response.status, 401);
});

test("quote-preview rejects non-manager roles", async () => {
  const request = new Request("https://example.test/api/v7/finance/quote-preview", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ grossAmountMinor: 10000, commissionBps: 1500, currency: "EUR" })
  });
  const response = await handleV7Route(request, {}, "/api/v7/finance/quote-preview", {
    user: { id: "user-1", role: "client" }
  });
  assert.equal(response.status, 403);
});

test("quote-preview returns a read-only quote to the authenticated manager", async () => {
  const request = new Request("https://example.test/api/v7/finance/quote-preview", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grossAmountMinor: 10000, commissionBps: 1500,
      paymentFeeMinor: 250, operatingCostMinor: 100, currency: "EUR"
    })
  });
  const response = await handleV7Route(request, {}, "/api/v7/finance/quote-preview", {
    user: { id: "manager-1", role: "gerante" }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.quote.commissionAmountMinor, 1500);
  assert.equal(body.quote.platformContributionMinor, 1150);
  assert.equal(body.quote.isQuotePreview, true);
  assert.equal(body.quote.createsFinancialObligation, false);
});
