import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoResolveSupportScenario } from '../src/copilot-action-policy.js';

test('only explicitly configured low-risk administrative scenarios may auto-resolve', () => {
  for (const scenario of ['DELAY_LIGHT', 'NOTIFICATION_FAILED', 'DOCUMENT_REMINDER']) {
    assert.equal(canAutoResolveSupportScenario(scenario, 'LOW', true), true, scenario);
  }
});

test('refund, complaint, payment, legal, safety and identity cases always require human review', () => {
  for (const scenario of [
    'SIMPLE_REFUND_CHECK', 'CLIENT_COMPLAINT', 'DUPLICATE_PAYMENT',
    'LEGAL_DISPUTE', 'IDENTITY_SECURITY', 'INTERVENANT_ABSENT'
  ]) {
    assert.equal(canAutoResolveSupportScenario(scenario, 'LOW', true), false, scenario);
  }
});

test('unknown, elevated severity, or database-disabled rules fail closed', () => {
  assert.equal(canAutoResolveSupportScenario('UNKNOWN', 'LOW', true), false);
  assert.equal(canAutoResolveSupportScenario('DELAY_LIGHT', 'MEDIUM', true), false);
  assert.equal(canAutoResolveSupportScenario('DELAY_LIGHT', 'HIGH', true), false);
  assert.equal(canAutoResolveSupportScenario('DELAY_LIGHT', 'LOW', false), false);
  assert.equal(canAutoResolveSupportScenario('DELAY_LIGHT', 'LOW', 1), false);
});
test('legacy French operational case names cannot bypass the central auto-resolution allowlist', () => {
  for (const scenario of [
    'retard_leger', 'notification_non_envoyee', 'document_expire_non_critique',
    'facture_non_envoyee', 'rappel_commercial', 'rappel_document',
    'absence_confirmation', 'petit_ecart_tarifaire',
    'reclamation_information', 'incident_technique_recoverable'
  ]) {
    assert.equal(canAutoResolveSupportScenario(scenario, 'LOW', true), false, scenario);
  }
});
