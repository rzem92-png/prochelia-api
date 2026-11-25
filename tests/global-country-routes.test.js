import test from "node:test";
import assert from "node:assert/strict";
import { handleGlobalCountryRoute } from "../src/global-country-routes.js";

const get = (path) => new Request("https://api.example.test" + path);

test("country list is public metadata, sorted and all markets remain disabled", async () => {
  const response = handleGlobalCountryRoute(get("/api/global/countries"), "/api/global/countries");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.count, 14);
  assert.deepEqual(body.countries.map(c => c.code), [...body.countries.map(c => c.code)].sort());
  assert.equal(body.countries.every(c => c.available === false), true);
  assert.ok(body.countries.every(c => c.locales.length > 0 && c.currency.length === 3));
});

test("country detail resolves normalized code and returns only public fields", async () => {
  const response = handleGlobalCountryRoute(get("/api/global/countries/dz"), "/api/global/countries/dz");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.country.code, "DZ");
  assert.equal(body.country.currency, "DZD");
  assert.equal(body.country.available, false);
  assert.equal("launchGates" in body.country, false);
});

test("country timezone endpoint returns curated regions without enabling markets", async () => {
  const response = handleGlobalCountryRoute(get("/api/global/countries/CA/timezones"), "/api/global/countries/CA/timezones");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.countryCode, "CA");
  assert.equal(body.defaultTimezone, null);
  assert.ok(body.timezones.some((zone) => zone.id === "America/Toronto"));
  assert.equal("available" in body, false);
});

test("timezone endpoint rejects unsupported countries and non-GET", async () => {
  const unknown = await handleGlobalCountryRoute(get("/api/global/countries/ZZ/timezones"), "/api/global/countries/ZZ/timezones").json();
  assert.equal(unknown.error, "COUNTRY_NOT_FOUND");
  const response = handleGlobalCountryRoute(new Request("https://api.example.test/api/global/countries/CA/timezones", { method: "POST" }), "/api/global/countries/CA/timezones");
  assert.equal(response.status, 405);
});

test("country launch checklist returns required human evidence as unassessed and fail-closed", async () => {
  const response = handleGlobalCountryRoute(get("/api/global/countries/fr/launch-checklist"), "/api/global/countries/fr/launch-checklist");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.country.code, "FR");
  assert.equal(body.country.marketStatus, "pilot_candidate");
  assert.equal(body.checklist.requiredCount, 6);
  assert.equal(body.checklist.assessedCount, 0);
  assert.equal(body.checklist.approvedCount, 0);
  assert.equal(body.checklist.gates.every((gate) => gate.required && gate.status === "not_assessed" && gate.approvalRecorded === false), true);
  assert.equal(body.launchEligible, false);
  assert.equal(body.activationAllowed, false);
  assert.match(body.note, /does not store|ne stocke/i);
  assert.ok(body.checklist.gates.every((gate) => gate.owner && gate.evidenceRequired));
});

test("launch checklist rejects unknown country and all non-GET requests", async () => {
  const unknown = await handleGlobalCountryRoute(get("/api/global/countries/ZZ/launch-checklist"), "/api/global/countries/ZZ/launch-checklist");
  assert.equal(unknown.status, 404);
  const response = handleGlobalCountryRoute(new Request("https://api.example.test/api/global/countries/FR/launch-checklist", { method: "POST" }), "/api/global/countries/FR/launch-checklist");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});


test("global launch summary covers all configured countries and remains fail-closed", async () => {
  const response = handleGlobalCountryRoute(get("/api/global/countries/launch-summary"), "/api/global/countries/launch-summary");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.summary.countryCount, 14);
  assert.equal(body.summary.marketEnabledCount, 0);
  assert.equal(body.summary.requiredGateCount, 84);
  assert.equal(body.summary.assessedGateCount, 0);
  assert.equal(body.summary.approvedGateCount, 0);
  assert.equal(body.summary.status, "not_assessed");
  assert.equal(body.summary.launchEligible, false);
  assert.equal(body.summary.activationAllowed, false);
  assert.deepEqual(body.countries.map((country) => country.code), [...body.countries.map((country) => country.code)].sort());
  assert.ok(body.countries.every((country) => country.requiredCount === 6 && country.assessedCount === 0 && country.approvedCount === 0));
  assert.ok(body.countries.every((country) => country.status === "not_assessed" && country.launchEligible === false && country.activationAllowed === false));
  assert.ok(body.countries.every((country) => country.gates.length === 6 && country.gates.every((gate) => gate.status === "not_assessed" && gate.approvalRecorded === false)));
  assert.match(body.note, /aucun pays n'est activé|no country is enabled/i);
});

test("global launch summary is GET-only and unrelated paths remain unhandled", async () => {
  const response = handleGlobalCountryRoute(new Request("https://api.example.test/api/global/countries/launch-summary", { method: "POST" }), "/api/global/countries/launch-summary");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
  assert.equal(handleGlobalCountryRoute(get("/api/global/countries/launch-summary/extra"), "/api/global/countries/launch-summary/extra"), null);
});

test("unknown country returns 404", async () => {
  const response = handleGlobalCountryRoute(get("/api/global/countries/zz"), "/api/global/countries/zz");
  assert.equal(response.status, 404);
});

test("route rejects non-GET and unrelated paths are not handled", async () => {
  const response = handleGlobalCountryRoute(new Request("https://api.example.test/api/global/countries", { method: "POST" }), "/api/global/countries");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
  assert.equal(handleGlobalCountryRoute(get("/api/global/country"), "/api/global/country"), null);
});

test("route is mounted in the API request handler", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.ok(source.includes('import { handleGlobalCountryRoute } from "./global-country-routes.js";'));
  assert.ok(source.includes("const globalCountryResponse = handleGlobalCountryRoute(request, url.pathname);"));
});
