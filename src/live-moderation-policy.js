// Nexus Supra — first-pass live moderation policy.
// Deterministic rules only: this module is a safe baseline, not an AI semantic model.
// It returns an action plan. It does not mute, suspend, pause, persist, or report by itself.

export const LIVE_MODERATION_POLICY_VERSION = "1.1.0";
export const LIVE_MODERATION_PROFILES = Object.freeze(["standard", "reinforced", "maximum"]);

const STRONG_INSULTS = /\b(?:connard|connasse|salaud|salope|pute|encule|enfoire|batard|fils de pute|fuck you|bitch|asshole|motherfucker|piece of shit)\b/i;
const MILD_INSULTS = /\b(?:con|conne|idiot|imbecile|debile|cretin|stupide|bouffon|clown|moron|dumb|stupid)\b/i;
const DIRECT_TARGET = /\b(?:tu|toi|t es|vous|il|elle|ce|cette|cet|ce type|cette personne)\b.{0,35}\b(?:con|conne|idiot|imbecile|debile|cretin|stupide|bouffon|clown|moron|dumb|stupid)\b/i;
const META_MENTION = /\b(?:le mot|le terme|definition|citation|exemple|traduction|dans cette phrase)\b/i;
const PROFANITY = /\b(?:putain|merde|fuck|shit|damn|fucking|bullshit)\b/i;

const THREAT_PATTERNS = [
  /\b(?:je vais|j vais|j\s*vais|on va|i will|i am going to|im going to|we will)\s+(?:te|vous|lui|le|la|him|her|them)?\s*(?:tuer|kill|frapper|tabasser|blesser|faire du mal|shoot|stab|beat|hurt)\b/i,
  /\b(?:je te|on te|i will|we will)\s+(?:tue|frappe|tabasse|blesse|kill|shoot|stab|hurt)\b/i,
  /\b(?:je vais|on va|i will|we will)\s+(?:bruler|burn|faire exploser|blow up)\s+(?:ta|ton|your)\s+(?:maison|voiture|home|house|car)\b/i,
  /\b(?:je vais|on va|i will|we will)\s+(?:te\s+)?(?:retrouver|come find you|find you)\b/i
];
const CRITICAL_THREAT_WORDS = /\b(?:tuer|kill|shoot|stab|faire exploser|blow up)\b/i;

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const FRENCH_PHONE = /(?:\+33|0033|0)[1-9](?:[\s().-]?\d{2}){4}\b/;
const INTERNATIONAL_PHONE = /\+\d{7,15}\b/;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const STREET_ADDRESS = /\b\d{1,5}\s+(?:rue|avenue|av\.?|boulevard|bd\.?|impasse|allee|chemin|route|place|quai)\s+[\p{L}\p{N}' -]{3,50}\b/iu;
const ADDRESS_REVERSE = /\b(?:rue|avenue|boulevard|impasse|allee|chemin|route|place|quai)\s+[\p{L}' -]{3,40}\s+(?:n(?:o|°)?\s*)?\d{1,5}\b/iu;

function normalizeModerationText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0@]/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/(.)\1{2,}/g, "$1")
    .trim();
}

function normalizeObfuscatedEmail(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|<\s*at\s*>|arrobase)\s*/gi, "@")
    .replace(/\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|<\s*dot\s*>|point)\s*/gi, ".");
}

function findPersonalData(text) {
  if (EMAIL.test(text) || EMAIL.test(normalizeObfuscatedEmail(text))) return "email";
  if (FRENCH_PHONE.test(text) || INTERNATIONAL_PHONE.test(text)) return "phone";
  if (IPV4.test(text)) return "ip_address";
  if (STREET_ADDRESS.test(text) || ADDRESS_REVERSE.test(text)) return "street_address";
  return null;
}

function findThreat(text) {
  const normalized = normalizeModerationText(text);
  const matched = THREAT_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!matched) return null;
  return CRITICAL_THREAT_WORDS.test(normalized) ? "explicit_violent_threat" : "threat";
}

function findInsult(text, profile) {
  const normalized = normalizeModerationText(text);
  const metaMention = META_MENTION.test(normalized) && !DIRECT_TARGET.test(normalized);
  if (metaMention) return null;
  if (STRONG_INSULTS.test(normalized)) return "targeted_insult";
  if (MILD_INSULTS.test(normalized)) return "targeted_insult";
  if (profile !== "standard" && PROFANITY.test(normalized)) return "profanity";
  return null;
}

function findSpam(text) {
  const normalized = normalizeModerationText(text);
  const links = (normalized.match(/https?:\/\//g) || []).length;
  if (links >= 4) return "link_spam";
  if (/(\b\w+\b)(?:\s+\1){4,}/i.test(normalized)) return "repeated_text";
  return null;
}

function addUnique(target, value) {
  if (!target.includes(value)) target.push(value);
}

function actionPlan(findings, { profile = "standard", recentViolations = 0 } = {}) {
  const actions = [];
  const categories = findings.map((item) => item.category);
  const criticalThreat = categories.includes("explicit_violent_threat");
  const threat = categories.includes("threat") || criticalThreat;
  const personalData = categories.includes("personal_data");
  const insult = categories.includes("targeted_insult") || categories.includes("profanity");
  const spam = categories.includes("spam");

  if (findings.length === 0) return { decision: "allow", actions, severity: "none" };

  const profanityOnly = categories.length === 1 && categories[0] === "profanity";
  if (profile === "reinforced" && profanityOnly) {
    return { decision: "mask", actions: ["mask_profanity"], severity: "low" };
  }

  addUnique(actions, "block_message");
  if (personalData) {
    addUnique(actions, "redact_personal_data");
    addUnique(actions, "exclude_from_replay");
    addUnique(actions, "notify_live_host");
    addUnique(actions, "create_safety_incident");
  }
  if (threat) {
    addUnique(actions, "temporary_live_timeout");
    addUnique(actions, "notify_live_host");
    addUnique(actions, "create_safety_incident");
    if (criticalThreat) addUnique(actions, "pause_live_for_review");
  } else if (insult) {
    addUnique(actions, "warn_user");
    if (recentViolations >= 5) addUnique(actions, "suspend_user_from_live_24h");
    else if (recentViolations >= 3) addUnique(actions, "temporary_live_timeout_30m");
    else if (recentViolations >= 1) addUnique(actions, "temporary_live_timeout_5m");
  }
  if (spam) {
    addUnique(actions, "warn_user");
    addUnique(actions, "temporary_live_timeout_5m");
  }

  const severity = criticalThreat || personalData ? "critical" : threat ? "high" : insult || spam ? "medium" : "low";
  const decision = actions.includes("pause_live_for_review") ? "block_and_pause_for_review" : "block";
  return { decision, actions, severity };
}

/**
 * Evaluate a live comment. recentViolations is intended for a trusted server-side
 * event pipeline; the public preview route deliberately does not accept it.
 * The source text is never included in the returned decision.
 */
export function evaluateLiveMessage(text, options = {}) {
  if (typeof text !== "string") {
    return { ok: false, error: "TEXT_REQUIRED", policy_version: LIVE_MODERATION_POLICY_VERSION };
  }
  if (text.length > 3000) {
    return { ok: false, error: "TEXT_TOO_LONG", max_length: 3000, policy_version: LIVE_MODERATION_POLICY_VERSION };
  }
  if (!text.trim()) {
    return { ok: false, error: "TEXT_REQUIRED", policy_version: LIVE_MODERATION_POLICY_VERSION };
  }

  const profile = LIVE_MODERATION_PROFILES.includes(options.profile) ? options.profile : "standard";
  const findings = [];
  const personalDataType = findPersonalData(text);
  const threatType = findThreat(text);
  const insultType = findInsult(text, profile);
  const spamType = findSpam(text);

  if (personalDataType) findings.push({ category: "personal_data", code: personalDataType });
  if (threatType) findings.push({ category: threatType === "explicit_violent_threat" ? "explicit_violent_threat" : "threat", code: threatType });
  if (insultType) findings.push({ category: insultType === "profanity" ? "profanity" : "targeted_insult", code: insultType });
  if (spamType) findings.push({ category: "spam", code: spamType });

  const plan = actionPlan(findings, {
    profile,
    recentViolations: Number.isInteger(options.recentViolations) && options.recentViolations >= 0
      ? Math.min(options.recentViolations, 20)
      : 0
  });

  return {
    ok: true,
    policy_version: LIVE_MODERATION_POLICY_VERSION,
    engine: "deterministic_rules_only",
    profile,
    decision: plan.decision,
    severity: plan.severity,
    reason_codes: findings.map((item) => item.code),
    categories: [...new Set(findings.map((item) => item.category))],
    actions: plan.actions,
    execution: "policy_plan_only",
    permanent_account_suspension: false,
    human_review_required_for_permanent_sanctions: true
  };
}

export default evaluateLiveMessage;
