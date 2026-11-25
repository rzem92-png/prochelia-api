import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLiveMessage } from "../src/live-moderation-policy.js";

test("allows factual discussion of crime and victims without topic-based censorship", () => {
  const result = evaluateLiveMessage("Le procès doit établir les faits et protéger la victime.");
  assert.equal(result.decision, "allow");
  assert.deepEqual(result.actions, []);
});

test("allows criticism of a public decision without personal attack", () => {
  const result = evaluateLiveMessage("Je critique cette décision de justice et je demande des explications.");
  assert.equal(result.decision, "allow");
  assert.equal(result.severity, "none");
});

test("blocks a direct targeted insult and recommends a warning", () => {
  const result = evaluateLiveMessage("Tu es un connard.");
  assert.equal(result.decision, "block");
  assert.ok(result.actions.includes("block_message"));
  assert.ok(result.actions.includes("warn_user"));
  assert.ok(result.reason_codes.includes("targeted_insult"));
});

test("does not block a neutral educational mention of an insult", () => {
  const result = evaluateLiveMessage("Le mot connard est une insulte dans cette phrase.");
  assert.equal(result.decision, "allow");
});

test("a context marker cannot whitelist an actual personal attack", () => {
  const result = evaluateLiveMessage("La personne est un connard, cette insulte est inadmissible.");
  assert.equal(result.decision, "block");
});

test("blocks explicit violent threats and pauses the affected live for review", () => {
  const result = evaluateLiveMessage("Je vais te tuer.");
  assert.equal(result.decision, "block_and_pause_for_review");
  assert.ok(result.actions.includes("temporary_live_timeout"));
  assert.ok(result.actions.includes("pause_live_for_review"));
  assert.ok(result.actions.includes("create_safety_incident"));
});

test("blocks phone, email, IP and street-address disclosures without returning the source text", () => {
  for (const text of [
    "Son numéro est 06 12 34 56 78",
    "Contact: victime@example.com",
    "Adresse IP: 192.168.1.12",
    "Il habite 12 rue de la Paix"
  ]) {
    const result = evaluateLiveMessage(text);
    assert.equal(result.decision, "block", text);
    assert.ok(result.actions.includes("redact_personal_data"));
    assert.ok(result.actions.includes("exclude_from_replay"));
    assert.ok(!JSON.stringify(result).includes(text));
  }
});

test("escalates repeated insult violations with temporary live-only sanctions", () => {
  assert.ok(evaluateLiveMessage("Idiot.", { recentViolations: 1 }).actions.includes("temporary_live_timeout_5m"));
  assert.ok(evaluateLiveMessage("Idiot.", { recentViolations: 3 }).actions.includes("temporary_live_timeout_30m"));
  assert.ok(evaluateLiveMessage("Idiot.", { recentViolations: 5 }).actions.includes("suspend_user_from_live_24h"));
  const result = evaluateLiveMessage("Idiot.", { recentViolations: 5 });
  assert.equal(result.permanent_account_suspension, false);
  assert.equal(result.human_review_required_for_permanent_sanctions, true);
});

test("standard profile does not censor non-targeted profanity; maximum profile can filter it", () => {
  assert.equal(evaluateLiveMessage("C'est putain de compliqué.", { profile: "standard" }).decision, "allow");
  const reinforced = evaluateLiveMessage("C'est putain de compliqué.", { profile: "reinforced" });
  assert.equal(reinforced.decision, "mask");
  assert.ok(reinforced.actions.includes("mask_profanity"));
  assert.equal(evaluateLiveMessage("C'est putain de compliqué.", { profile: "maximum" }).decision, "block");
});

test("blocks obvious repeated-text spam", () => {
  const result = evaluateLiveMessage("promo promo promo promo promo");
  assert.equal(result.decision, "block");
  assert.ok(result.reason_codes.includes("repeated_text"));
});

test("rejects blank, non-string and oversized input", () => {
  assert.equal(evaluateLiveMessage("").error, "TEXT_REQUIRED");
  assert.equal(evaluateLiveMessage(null).error, "TEXT_REQUIRED");
  assert.equal(evaluateLiveMessage("x".repeat(3001)).error, "TEXT_TOO_LONG");
});
