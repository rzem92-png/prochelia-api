import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("identity and mission security schema check is read-only", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureSecuritySchema(env) {");
  const end = source.indexOf("\nfunction securityCode()", start);
  assert.ok(start >= 0 && end > start, "security schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /IDENTITY_SECURITY_SCHEMA_NOT_READY/);
  assert.doesNotMatch(helper, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "identity_verifications",
    "idx_identity_verifications_user",
    "trusted_devices",
    "mission_security",
    "idx_mission_security_intervenant",
    "mission_security_attempts",
    "idx_security_attempts_security",
    "security_audit",
    "idx_security_audit_mission"
  ]) assert.ok(helper.includes(objectName), `missing schema contract: ${objectName}`);
});
