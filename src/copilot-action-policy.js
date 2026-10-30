/**
 * Central policy for automatic support-case resolution.
 *
 * Only low-impact, reversible administrative/technical actions may be
 * automated. Payments, refunds, complaints, legal, identity, safety,
 * worker-status and contractual decisions always require human review.
 * This is an operational safeguard, not a legal classification engine.
 */
const LOW_RISK_AUTOMATABLE_SCENARIOS = new Set([
  'DELAY_LIGHT',
  'NOTIFICATION_FAILED',
  'DOCUMENT_REMINDER'
]);

export function canAutoResolveSupportScenario(scenario, severity, configuredAutoAllowed) {
  if (configuredAutoAllowed !== true) return false;
  if (String(severity || '').toUpperCase() !== 'LOW') return false;
  return LOW_RISK_AUTOMATABLE_SCENARIOS.has(String(scenario || '').toUpperCase());
}
