import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySupraAutonomy, rankSupraProposals, createSupraApprovalSummary } from '../src/supra-decision-ranking.js';

const proposal = (overrides = {}) => ({
  id: 'option-1',
  title: 'Resolve booking conflict',
  description: 'Check source of truth and prepare alternatives',
  risk: 'low',
  expectedOutcome: 'Restore correct booking status without double charge',
  evidenceReference: 'case-evidence-42',
  ownerDomain: 'missions',
  impact: 90,
  confidence: 85,
  urgency: 80,
  reversibility: 95,
  costEfficiency: 75,
  ...overrides
});

test('SUPRA autonomy defaults to observe and only permits preauthorized reversible actions', () => {
  assert.equal(classifySupraAutonomy({}).level, 'A0');
  assert.equal(classifySupraAutonomy({ draftOnly: true }).level, 'A1');
  assert.equal(classifySupraAutonomy({ preapproved: true, reversible: true, adapterVerified: true, authorizationVerified: true, idempotencyVerified: true }).level, 'A2');
});

test('financial, legal, security, production and irreversible actions require mandatory human review', () => {
  for (const risk of ['payment', 'legal', 'security', 'production', 'deletion']) {
    assert.equal(classifySupraAutonomy({ riskTypes: [risk] }).level, 'A4');
  }
  assert.equal(classifySupraAutonomy({ irreversible: true }).level, 'A4');
  assert.equal(classifySupraAutonomy({ externalSideEffect: true }).level, 'A3');
});

test('proposal ranking is deterministic, transparent and validates input', () => {
  const ranked = rankSupraProposals([proposal(), proposal({ id: 'option-2', title: 'Wait and notify', impact: 40, urgency: 30 })]);
  assert.equal(ranked.ok, true);
  assert.equal(ranked.proposals[0].id, 'option-1');
  assert.equal(ranked.proposals[0].rank, 1);
  assert.equal(ranked.proposals[0].score, 85.75);
  assert.equal(rankSupraProposals([proposal(), proposal()]).code, 'DUPLICATE_PROPOSAL_ID');
  assert.equal(rankSupraProposals([proposal({ confidence: 101 })]).code, 'INVALID_PROPOSAL');
  assert.equal(rankSupraProposals([]).ok, false);
});

test('approval summary requires evidence and never authorizes execution', () => {
  const result = createSupraApprovalSummary(proposal(), { caseId: 'case-42', generatedAt: '2026-11-05T09:00:00Z' });
  assert.equal(result.ok, true);
  assert.equal(result.approval.executionAllowed, false);
  assert.deepEqual(result.approval.choices, ['approve', 'reject', 'request_more_evidence']);
  assert.equal(createSupraApprovalSummary(proposal(), {}).ok, false);
});

test('proposal risk labels cannot understate approval requirements', () => {
  const high = rankSupraProposals([proposal({ risk: 'high' })]);
  const critical = rankSupraProposals([proposal({ risk: 'critical' })]);
  const medium = rankSupraProposals([proposal({ risk: 'medium' })]);
  assert.equal(high.ok, true);
  assert.equal(high.proposals[0].autonomy.level, 'A4');
  assert.equal(high.proposals[0].requiresManagerApproval, true);
  assert.equal(critical.proposals[0].autonomy.level, 'A4');
  assert.equal(critical.proposals[0].requiresManagerApproval, true);
  assert.equal(medium.proposals[0].autonomy.level, 'A1');
});
