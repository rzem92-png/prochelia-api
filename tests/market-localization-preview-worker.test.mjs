import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/market-localization-preview-worker.js";

const request = (path, method = "GET") => new Request("https://market-preview.example" + path, { method });

test("isolated Preview serves the 14 candidate markets with no launch activation", async () => {
  const response = await worker.fetch(request("/api/platform/markets"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  const body = await response.json();
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.markets.length, 14);
  assert.equal(body.launchEnabled, false);
  assert.equal(body.requiredHumanApproval, true);
  assert.ok(body.markets.every(market => market.readiness === "NOT_ASSESSED"));
  assert.ok(body.markets.every(market => market.launchEnabled === false));
  assert.ok(body.markets.every(market => market.gates.length === 14));
});

test("market filter returns only France and unknown country fails closed", async () => {
  const france = await worker.fetch(request("/api/platform/markets?country=fr"));
  assert.equal(france.status, 200);
  assert.deepEqual((await france.json()).markets.map(market => market.code), ["FR"]);
  const unknown = await worker.fetch(request("/api/platform/markets?country=ZZ"));
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error, "MARKET_NOT_FOUND");
});

test("localization endpoint returns Algeria locale and DZD formatting metadata without tax or launch approval", async () => {
  const response = await worker.fetch(request("/api/platform/markets/DZ/localization"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  const value = body.localization;
  assert.equal(value.countryCode, "DZ");
  assert.equal(value.currency, "DZD");
  assert.deepEqual(value.locales, ["ar-DZ", "fr-DZ"]);
  assert.equal(value.preferredLocale, "ar-DZ");
  assert.equal(value.timeZone.default, null);
  assert.equal(value.taxConfiguration.status, "NOT_CONFIGURED");
  assert.equal(value.launchEnabled, false);
  assert.equal(value.requiredHumanApproval, true);
});

test("unknown localization market is 404 and mutation methods are rejected", async () => {
  const unknown = await worker.fetch(request("/api/platform/markets/ZZ/localization"));
  assert.equal(unknown.status, 404);
  const post = await worker.fetch(request("/api/platform/markets", "POST"));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET");
  assert.equal(post.headers.get("access-control-allow-origin"), "*");
  const options = await worker.fetch(request("/api/platform/markets", "OPTIONS"));
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "*");
  assert.equal(options.headers.get("allow"), "GET, OPTIONS");
  const postLocalization = await worker.fetch(request("/api/platform/markets/FR/localization", "POST"));
  assert.equal(postLocalization.status, 405);
  assert.equal(postLocalization.headers.get("allow"), "GET");
});

test("unknown routes are no-store 404 and worker has no runtime bindings", async () => {
  const missing = await worker.fetch(request("/api/not-market"));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");
  // The entrypoint intentionally ignores env; this confirms no DB or secret is required.
  const withEmptyEnv = await worker.fetch(request("/api/platform/markets"), {});
  assert.equal(withEmptyEnv.status, 200);
});
