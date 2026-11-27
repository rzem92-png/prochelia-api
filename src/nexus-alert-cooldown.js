/* Pure alert cooldown/deduplication helper for Nexus. State is caller-persisted.
 * Preview/dev/test only; no writes, no task identifiers, and no execution authority.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusAlertCooldown = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const ENVS = new Set(["preview", "development", "test"]);
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const SEVERITIES = new Set(["info", "warning", "high", "critical"]);
  const plain = value => !!value && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
    Object.getOwnPropertySymbols(value).length === 0 &&
    Object.keys(Object.getOwnPropertyDescriptors(value)).every(k => {
      const d = Object.getOwnPropertyDescriptor(value, k); return d.enumerable && Object.hasOwn(d, "value");
    });
  function validTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    const t = Date.parse(value); return Number.isFinite(t) && new Date(t).toISOString() === value;
  }
  function invalid() { return { ok: false, mode: "READ_ONLY_ALERT_COOLDOWN", executionAllowed: false, status: "UNKNOWN", emitted: [], suppressed: [], nextState: null }; }
  function applyAlertCooldown(input = {}) {
    if (!plain(input) || !ENVS.has(input.environment) || !validTime(input.now) ||
        !Number.isSafeInteger(input.cooldownSeconds) || input.cooldownSeconds < 0 || input.cooldownSeconds > 86400 ||
        !Array.isArray(input.alerts) || input.alerts.length > 100 ||
        (input.scopeKey !== null && input.scopeKey !== undefined && !ID.test(input.scopeKey)) ||
        (input.previousState !== undefined && input.previousState !== null && !plain(input.previousState))) return invalid();
    const scopeKey = input.scopeKey ?? "__GLOBAL__";
    const previous = input.previousState ?? {};
    const emitted = [], suppressed = [], nextState = {};
    const nowMs = Date.parse(input.now), cooldownMs = input.cooldownSeconds * 1000;
    for (const alert of input.alerts) {
      if (!plain(alert) || typeof alert.code !== "string" || !ID.test(alert.code) ||
          !SEVERITIES.has(alert.severity) || !Number.isSafeInteger(alert.count) || alert.count < 1) return invalid();
      const key = scopeKey + "|" + alert.code;
      const prev = previous[key];
      if (prev !== undefined && (!plain(prev) || !validTime(prev.lastEmittedAt) ||
          !Number.isSafeInteger(prev.lastCount) || prev.lastCount < 0)) return invalid();
      const last = prev ? Date.parse(prev.lastEmittedAt) : null;
      const within = last !== null && nowMs >= last && nowMs - last < cooldownMs;
      const escalation = prev && alert.severity !== prev.severity;
      const countChanged = prev && alert.count > prev.lastCount;
      const shouldEmit = !within || escalation || countChanged;
      const safeAlert = { code: alert.code, severity: alert.severity, count: alert.count };
      if (shouldEmit) {
        emitted.push(safeAlert);
        nextState[key] = { lastEmittedAt: input.now, lastCount: alert.count, severity: alert.severity };
      } else {
        suppressed.push({ code: alert.code, severity: alert.severity, count: alert.count, lastEmittedAt: prev.lastEmittedAt });
        nextState[key] = prev;
      }
    }
    return { ok: true, status: "EVALUATED", scopeKey, environment: input.environment, evaluatedAt: input.now,
      emitted, suppressed, nextState, executionAllowed: false, mode: "READ_ONLY_ALERT_COOLDOWN" };
  }
  return Object.freeze({ applyAlertCooldown });
});