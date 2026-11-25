import test from "node:test";
import assert from "node:assert/strict";
import { listCountryConfigs, getCountryConfig } from "../src/global-country-registry.js";
import { getCountryLaunchAssessmentTemplate } from "../src/country-launch-assessment-template.js";
import { handleGlobalCountryRoute } from "../src/global-country-routes.js";

const get = (path) => new Request("https://api.example.test" + path);

test("launch assessment template covers the registry and stays non-persistent/fail-closed", () => {
  const countries = listCountryConfigs();
  assert.equal(countries.length, 14);
  for (const country of countries) {
    const template = getCountryLaunchAssessmentTemplate(country);
    assert.equal(template.templateVersion, "country-launch-assessment-v1.0.0");
    assert.equal(template.country.code, country.code);
    assert.equal(template.territorialScope.required, true);
    assert.equal(template.territorialScope.question.required, true);
    assert.equal(template.sections.length, 6);
    assert.deepEqual(template.sections.map(section => section.id), country.launchGates);
    assert.ok(template.sections.every(section => section.reviewerRole && section.evidenceSuggested.length > 0));
    assert.ok(template.sections.every(section => section.questions.length === 3 && section.questions.every(question => question.id && question.required && question.prompt)));
    const ids = [template.territorialScope.question.id, ...template.sections.flatMap(section => section.questions.map(question => question.id))];
    assert.equal(new Set(ids).size, ids.length, "question IDs must be unique within a country template");
    assert.equal(template.evidenceUploadEnabled, false);
    assert.equal(template.responsePersistenceEnabled, false);
    assert.equal(template.approvalRecorded, false);
    assert.equal(template.launchEligible, false);
    assert.equal(template.activationAllowed, false);
    assert.ok(template.sections.every(section => section.questions.every(question => !("defaultAnswer" in question))));
  }
});

test("territorial scope prompts distinguish multi-level markets without claiming legal validation", () => {
  const canada = getCountryLaunchAssessmentTemplate(getCountryConfig("CA"));
  const usa = getCountryLaunchAssessmentTemplate(getCountryConfig("US"));
  const france = getCountryLaunchAssessmentTemplate(getCountryConfig("FR"));
  assert.match(canada.territorialScope.hint, /provinces, territoires/i);
  assert.match(usa.territorialScope.hint, /États, territoires/i);
  assert.match(france.territorialScope.hint, /territoires, villes/i);
  assert.match(canada.note, /professionnels locaux/i);
});

test("launch assessment template route is GET-only and unknown countries are rejected", async () => {
  const path = "/api/global/countries/FR/launch-assessment-template";
  const response = handleGlobalCountryRoute(get(path), path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.country.code, "FR");
  assert.equal(body.sections.length, 6);
  assert.equal(body.activationAllowed, false);

  const denied = handleGlobalCountryRoute(new Request("https://api.example.test" + path, { method: "POST" }), path);
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get("allow"), "GET");
  const unknownPath = "/api/global/countries/ZZ/launch-assessment-template";
  const unknown = handleGlobalCountryRoute(get(unknownPath), unknownPath);
  assert.equal(unknown.status, 404);
  const unrelated = "/api/global/countries/FR/launch-assessment-template/extra";
  assert.equal(handleGlobalCountryRoute(get(unrelated), unrelated), null);
});
