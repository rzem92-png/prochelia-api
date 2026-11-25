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
