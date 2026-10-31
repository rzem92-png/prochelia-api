import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateForecastContributionCents } from '../src/finance-model-v1.js';

test('forecast contribution counts platform commission once and subtracts fees and refunds', () => {
  const result = calculateForecastContributionCents({ commissionCents: 2000, providerFeeCents: 240, refundCents: 100 });
  assert.deepEqual(result, { ok: true, contribution_cents: 1660 });
});

test('forecast contribution may be negative and never counts gross collections or provider payout twice', () => {
  const result = calculateForecastContributionCents({ commissionCents: 100, providerFeeCents: 80, refundCents: 50 });
  assert.deepEqual(result, { ok: true, contribution_cents: -30 });
});

test('forecast contribution rejects missing, fractional, negative and unsafe inputs', () => {
  for (const input of [
    { commissionCents: 1.5, providerFeeCents: 0, refundCents: 0 },
    { commissionCents: 1, providerFeeCents: -1, refundCents: 0 },
    { commissionCents: Number.MAX_SAFE_INTEGER + 1, providerFeeCents: 0, refundCents: 0 },
    { commissionCents: 1, providerFeeCents: 0 }
  ]) assert.equal(calculateForecastContributionCents(input).ok, false);
});
