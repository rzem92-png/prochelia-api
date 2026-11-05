import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gatePath = new URL('../docs/PROCHELIA-TRANSACTION-E2E-RELEASE-GATE-V1.md', import.meta.url);
const gate = await readFile(gatePath, 'utf8');

test('E2E release contract: all critical business stages are documented', () => {
  const requiredStages = [
    'Inscription client',
    'Inscription intervenant/entreprise',
    'Vérification identité/éligibilité',
    'Recherche et découverte',
    'Création de demande/réservation',
    'Acceptation/refus par intervenant',
    'Paiement PSP en sandbox',
    'Mission confirmée et visible',
    'Début/fin de mission',
    'Preuve de réalisation',
    'Règlement intervenant simulé',
    'Avis/notation après mission',
    'Assistance, réclamation et litige',
    'SUPRA : triage',
    'Rapprochement comptable'
  ];
  for (const stage of requiredStages) assert.ok(gate.includes(stage), `Missing E2E stage: ${stage}`);
});

test('E2E release contract: transaction safety and adversarial cases are required', () => {
  const requiredScenarios = [
    'Réservation concurrente',
    'webhook dupliqué',
    'webhook hors ordre',
    'Double clic',
    'Remboursement total/partiel',
    'Payout refusé/retardé',
    'accéder à la mission d’autrui',
    'sources contradictoires',
    'Panne DB/PSP/notification',
    'Suppression/retention/anonymisation'
  ];
  for (const scenario of requiredScenarios) assert.ok(gate.includes(scenario), `Missing safety scenario: ${scenario}`);
});

test('E2E release contract: production remains gated and evidence is mandatory', () => {
  assert.match(gate, /Aucun statut « opérationnel de bout en bout »/);
  assert.match(gate, /Pas de paiement réel ni de D1 production dans les tests/);
  assert.match(gate, /CI verte seule n'est pas une recette E2E/);
  assert.match(gate, /Gérante donne une validation explicite/);
  assert.match(gate, /Current truth/);
  assert.match(gate, /ne prouve pas que le parcours est implémenté/);
});
