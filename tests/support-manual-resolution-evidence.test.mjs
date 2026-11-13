import test from "node:test";
import assert from "node:assert/strict";
import { supportManualResolutionAllowed } from "../src/index.js";

test("support closure requires a manager role and a meaningful resolution plus evidence", () => {
  const resolution = "Client contacted and issue reviewed.";
  const evidence = "Call log 2026-11-13, reference SUP-2026-001, outcome confirmed.";
  assert.equal(supportManualResolutionAllowed("GERANTE", resolution, evidence), true);
  assert.equal(supportManualResolutionAllowed("ADMIN", resolution, evidence), true);
});

test("support requesters cannot close their own case even when they supply evidence", () => {
  const resolution = "Client contacted and issue reviewed.";
  const evidence = "Call log 2026-11-13, reference SUP-2026-001, outcome confirmed.";
  for (const role of ["CLIENT", "INTERVENANT", "ENTREPRISE", "UNKNOWN", ""]) {
    assert.equal(supportManualResolutionAllowed(role, resolution, evidence), false);
  }
});

test("support closure fails closed for missing or weak evidence", () => {
  assert.equal(supportManualResolutionAllowed("GERANTE", "", "sufficient evidence text here"), false);
  assert.equal(supportManualResolutionAllowed("GERANTE", "Too short", "sufficient evidence text here"), false);
  assert.equal(supportManualResolutionAllowed("GERANTE", "Resolution is documented", "short"), false);
  assert.equal(supportManualResolutionAllowed("GERANTE", "Resolution is documented", ""), false);
});
