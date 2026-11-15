import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("mission execution remains fail-closed until professional profile review is implemented", () => {
  assert.match(source, /const PROFESSIONAL_PROFILE_REVIEW_READY = false;/);
  const start = source.indexOf("async function requireMissionEligibleIntervenant");
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, "mission eligibility guard must exist");
  const guard = source.slice(start, end + 2);
  assert.match(guard, /if\s*\(!PROFESSIONAL_PROFILE_REVIEW_READY\) return null;/);
  assert.match(guard, /return requireVerifiedIntervenant\(env, userId\);/);
});

test("mission preparation requires professional profile approval, not identity alone", () => {
  const start = source.indexOf("async function securityPrepareMission");
  const end = source.indexOf("\nasync function securityPresence", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /requireMissionEligibleIntervenant\(env,intervenantId\)/);
  assert.match(handler, /INTERVENANT_PROFILE_NOT_VERIFIED/);
  assert.doesNotMatch(handler, /requireVerifiedIntervenant\(env,intervenantId\)/);
});

test("presence and mission-code verification recheck the professional profile gate", () => {
  const presenceStart = source.indexOf("async function securityPresence");
  const verifyStart = source.indexOf("async function securityVerifyCode", presenceStart);
  const resendStart = source.indexOf("async function securityResendCodes", verifyStart);
  assert.ok(presenceStart >= 0 && verifyStart > presenceStart && resendStart > verifyStart);
  const presence = source.slice(presenceStart, verifyStart);
  const verify = source.slice(verifyStart, resendStart);
  assert.match(presence, /requireMissionEligibleIntervenant\(env, auth\.user\.id\)/);
  assert.match(verify, /requireMissionEligibleIntervenant\(env, auth\.user\.id\)/);
  assert.match(presence, /INTERVENANT_PROFILE_NOT_VERIFIED/);
  assert.match(verify, /INTERVENANT_PROFILE_NOT_VERIFIED/);
});

test("security routes never create D1 schema at request time", () => {
  assert.doesNotMatch(source, /ensureSecuritySchema/);
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS identity_verifications/);
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS mission_security/);
});
