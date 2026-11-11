
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("client profile route is session-bound and filters non-manager reads by user_id", () => {
  assert.match(source, /url\.pathname === '\/api\/clients'\) return profileDirectory\(request,env,'clients'\)/);
  assert.match(source, /const ownRole = kind === 'clients' \? role === 'client' : role === 'intervenant'/);
  assert.match(source, /WHERE p\.user_id = \?/);
  assert.match(source, /auth\.user\.id, limit, offset/);
  assert.match(source, /UNAUTHENTICATED/);
});

test("intervenant profile route is session-bound and never returns an unrestricted directory to non-managers", () => {
  assert.match(source, /url\.pathname === '\/api\/intervenants'\) return profileDirectory\(request,env,'intervenants'\)/);
  assert.match(source, /if \(!manager && !ownRole\)/);
  assert.match(source, /PROFILE_SCHEMA_UNAVAILABLE/);
  assert.match(source, /limit > 100/);
});

test("company directory access stays denied until a verified membership relation exists", () => {
  assert.match(source, /Company access is deliberately denied until a verified/);
  assert.match(source, /const manager = role === 'gerante'/);
  assert.doesNotMatch(source, /role === 'entreprise'.*manager/s);
});
