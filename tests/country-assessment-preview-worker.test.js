import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/country-assessment-preview-worker.js";

const request = (path, method = "GET") => new Request("https://preview-worker.example" + path, { method });

test("isolated country preview worker serves the 14-country registry read-only", async () => {
  const response = await worker.fetch(request("/api/global/countries"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const body = await response.json();
  assert.equal(body.count, 14);
  assert.ok(body.countries.every(country => country.available === false));
  assert.ok(body.countries.every(country => country.code && country.name && country.currency));
});

test("preview worker returns the versioned assessment template without persistence or activation", async () => {
  const response = await worker.fetch(request("/api/global/countries/FR/launch-assessment-template"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.country.code, "FR");
  assert.equal(body.templateVersion, "country-launch-assessment-v1.0.0");
  assert.equal(body.sections.length, 6);
  assert.equal(body.evidenceUploadEnabled, false);
  assert.equal(body.responsePersistenceEnabled, false);
  assert.equal(body.approvalRecorded, false);
  assert.equal(body.launchEligible, false);
  assert.equal(body.activationAllowed, false);
});

test("preview worker rejects mutations and unsupported routes", async () => {
  const mutation = await worker.fetch(request("/api/global/countries/FR/launch-assessment-template", "POST"));
  assert.equal(mutation.status, 405);
  assert.equal(mutation.headers.get("allow"), "GET");
  const missing = await worker.fetch(request("/api/not-preview"));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");
});
