import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/country-readiness-matrix-preview-worker.js";
import { buildCountryReadinessMatrix } from "../src/country-readiness-matrix.js";

const request = (path, method = "GET") => new Request("https://preview-matrix.example" + path, { method });

function fixtureSummary() {
  const codes = ["AE","BE","CA","CH","DE","DZ","ES","FR","GB","IT","LU","MA","TN","US"];
  return {
    ok: true,
    summary: { countryCount: 14, requiredGateCount: 84, assessedGateCount: 0, approvedGateCount: 0, launchEligible: false, activationAllowed: false },
    countries: codes.map(code => ({
      code,
      name: code === "DZ" ? "Algérie" : code === "FR" ? "France" : code,
      marketStatus: code === "FR" ? "pilot_candidate" : "planned",
      requiredCount: 6,
      assessedCount: 0,
      approvedCount: 0,
      status: "not_assessed",
      launchEligible: false,
      activationAllowed: false,
      gates: ["legal_review","tax_review","payments_review","data_protection_review","operations_review","human_activation"].map(id => ({id,label:id,status:"not_assessed",approvalRecorded:false}))
    }))
  };
}

test("matrix search is accent-insensitive and filters by configured market status", () => {
  const result = buildCountryReadinessMatrix(fixtureSummary(), new URLSearchParams("q=algerie&marketStatus=planned"));
  assert.equal(result.ok, true);
  assert.deepEqual(result.countries.map(country => country.code), ["DZ"]);
  assert.equal(result.summary.activationAllowedCount, 0);
});

test("matrix supports gate filters, deterministic sorting and bounded pagination", () => {
  const result = buildCountryReadinessMatrix(fixtureSummary(), new URLSearchParams("gate=tax_review&sort=name&limit=3&offset=3"));
  assert.equal(result.ok, true);
  assert.equal(result.pagination.total, 14);
  assert.equal(result.countries.length, 3);
  assert.equal(result.pagination.hasMore, true);
  assert.equal(result.pagination.nextOffset, 6);
  assert.ok(result.countries.every(country => country.gates.some(gate => gate.id === "tax_review")));
});

test("invalid query parameters fail closed with specific errors", () => {
  for (const [query,error] of [
    ["marketStatus=closed","INVALID_MARKET_STATUS"],
    ["gate=unknown","INVALID_LAUNCH_GATE"],
    ["gateStatus=done","INVALID_GATE_STATUS"],
    ["sort=unsafe","INVALID_SORT"],
    ["limit=0","INVALID_LIMIT"],
    ["limit=15","INVALID_LIMIT"],
    ["offset=-1","INVALID_OFFSET"],
    ["offset=1.5","INVALID_OFFSET"],
  ]) {
    const result = buildCountryReadinessMatrix(fixtureSummary(), new URLSearchParams(query));
    assert.equal(result.ok, false, query);
    assert.equal(result.error, error, query);
  }
});

test("gate status is evaluated on the selected gate, not another gate on the same country", () => {
  const summary = fixtureSummary();
  summary.countries[0].gates.find(gate => gate.id === "legal_review").status = "approved";
  const result = buildCountryReadinessMatrix(summary, new URLSearchParams("gate=tax_review&gateStatus=approved"));
  assert.equal(result.ok, true);
  assert.equal(result.summary.countryCount, 0);
  const approvedLegal = buildCountryReadinessMatrix(summary, new URLSearchParams("gate=legal_review&gateStatus=approved"));
  assert.equal(approvedLegal.summary.countryCount, 1);
  assert.equal(approvedLegal.countries[0].code, "AE");
});

test("matrix summary is computed over all filtered countries, not the current page", () => {
  const result = buildCountryReadinessMatrix(fixtureSummary(), new URLSearchParams("q=fr&limit=1"));
  assert.equal(result.summary.countryCount, 1);
  assert.equal(result.summary.requiredGateCount, 6);
  assert.equal(result.summary.assessedGateCount, 0);
  assert.equal(result.summary.approvedGateCount, 0);
  assert.equal(result.countries[0].activationAllowed, false);
});

test("preview Worker returns the live configured 14-country matrix without persistence or activation", async () => {
  const response = await worker.fetch(request("/api/global/countries/readiness-matrix"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const body = await response.json();
  assert.equal(body.summary.countryCount, 14);
  assert.equal(body.summary.requiredGateCount, 84);
  assert.equal(body.summary.assessedGateCount, 0);
  assert.equal(body.summary.approvedGateCount, 0);
  assert.equal(body.summary.launchEligibleCount, 0);
  assert.equal(body.summary.activationAllowedCount, 0);
  assert.ok(body.countries.every(country => country.gates.length === 6 && country.activationAllowed === false));
});

test("Preview Worker route is GET-only and unknown routes remain 404", async () => {
  const post = await worker.fetch(request("/api/global/countries/readiness-matrix", "POST"));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, OPTIONS");
  const missing = await worker.fetch(request("/api/unknown"));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");
});

test("matrix Preview Worker allows only PROCHÉLIA Pages HTTPS origins and exposes no credentials", async () => {
  const origin = "https://fix-wrangler-preview-config.prochelia.pages.dev";
  const response = await worker.fetch(new Request("https://preview-matrix.example/api/global/countries/readiness-matrix", {
    headers: { Origin: origin }
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(response.headers.get("access-control-allow-credentials"), null);

  const denied = await worker.fetch(new Request("https://preview-matrix.example/api/global/countries/readiness-matrix", {
    headers: { Origin: "https://evil.example" }
  }));
  assert.equal(denied.status, 200);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});

test("matrix Preview Worker handles CORS preflight without enabling writes", async () => {
  const origin = "https://prochelia.pages.dev";
  const response = await worker.fetch(new Request("https://preview-matrix.example/api/global/countries/readiness-matrix", {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "accept" }
  }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-headers"), "Accept");
  assert.equal(response.headers.get("allow"), "GET, OPTIONS");
});
