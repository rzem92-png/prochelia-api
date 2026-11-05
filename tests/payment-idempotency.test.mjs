import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameMissionPaymentOperation, isSamePayoutOperation } from '../src/index.js';

const mission = {
  type: 'MISSION_CHARGE', mission_id: 'mission-1', client_id: 'client-1',
  intervenant_id: 'provider-1', gross_cents: 12500, commission_cents: 1500,
  currency: 'EUR'
};
const missionRequest = {
  mission_id: 'mission-1', client_id: 'client-1', intervenant_id: 'provider-1',
  gross_cents: 12500, commission_cents: 1500
};

test('mission payment idempotency accepts only exact same operation', () => {
  assert.equal(isSameMissionPaymentOperation(mission, missionRequest), true);
  assert.equal(isSameMissionPaymentOperation(null, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, mission_id: 'mission-2'}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, client_id: 'client-2'}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, intervenant_id: 'provider-2'}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, gross_cents: 12501}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, commission_cents: 1501}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, type: 'REFUND'}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, currency: 'USD'}, missionRequest), false);
});

const payout = { user_id: 'provider-1', amount_cents: 5000, mode: 'standard', currency: 'EUR' };
const payoutRequest = { user_id: 'provider-1', amount_cents: 5000, mode: 'standard' };

test('payout idempotency prevents cross-user and parameter replay', () => {
  assert.equal(isSamePayoutOperation(payout, payoutRequest), true);
  assert.equal(isSamePayoutOperation(null, payoutRequest), false);
  assert.equal(isSamePayoutOperation({...payout, user_id: 'provider-2'}, payoutRequest), false);
  assert.equal(isSamePayoutOperation({...payout, amount_cents: 5001}, payoutRequest), false);
  assert.equal(isSamePayoutOperation({...payout, mode: 'express'}, payoutRequest), false);
  assert.equal(isSamePayoutOperation({...payout, currency: 'USD'}, payoutRequest), false);
});

test('financial idempotency rejects malformed persisted amount types', () => {
  assert.equal(isSameMissionPaymentOperation({...mission, gross_cents: '12500'}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, commission_cents: '1500'}, missionRequest), false);
  assert.equal(isSamePayoutOperation({...payout, amount_cents: '5000'}, payoutRequest), false);
});

test('financial idempotency rejects missing or altered currency and amounts', () => {
  assert.equal(isSameMissionPaymentOperation({...mission, currency: null}, missionRequest), false);
  assert.equal(isSameMissionPaymentOperation({...mission, gross_cents: 0}, missionRequest), false);
  assert.equal(isSamePayoutOperation({...payout, currency: null}, payoutRequest), false);
  assert.equal(isSamePayoutOperation({...payout, amount_cents: 0}, payoutRequest), false);
});
