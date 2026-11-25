import test from "node:test";
import assert from "node:assert/strict";
import { handleV7Route } from "../src/v7-routes.js";

test("GET markets exposes localized configuration and never enables markets", async () => {
  const response = await handleV7Route(new Request("https://example.test/api/v7/markets"), {}, "/api/v7/markets", null);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.markets.length, 14);
  assert.ok(body.markets.some((m) => m.countryCode === "DZ" && m.currency === "DZD" && m.locales.includes("ar-DZ")));
  assert.ok(body.markets.some((m) => m.countryCode === "FR" && m.currency === "EUR"));
  assert.ok(body.markets.every((m) => m.launchEligible === false));
  assert.match(body.note, /No market is activated/);
});

test("market endpoint is GET-only", async () => {
  const response = await handleV7Route(new Request("https://example.test/api/v7/markets", { method: "POST" }), {}, "/api/v7/markets", null);
  assert.equal(response, null);
});
