# SUPRA « GO » — orchestration end-to-end à déclenchement unique

## UX
Une action visible unique : **« SUPRA GO — lancer le parcours complet »**. L'utilisateur ne doit pas avoir à répéter « continue ». Le bouton déclenche une orchestration avec étapes, état persistant, reprise et compte rendu consolidé.

## Workflow
1. Charger l'objectif, les contraintes projet et les décisions validées.
2. Décomposer en tâches et dépendances; produire un plan et critères de réussite.
3. Scanner le code/configuration et les risques; vérifier branche cible et environnement.
4. Exécuter les changements autorisés en petites unités, avec checkpoints.
5. Lancer tests unitaires, intégration, sécurité, non-régression, lint/build et scénarios adversariaux disponibles.
6. Corriger automatiquement les erreurs de faible risque, relancer les tests, plafonner les tentatives et arrêter en cas de boucle.
7. Produire un rapport consolidé : commit(s), fichiers, tests réellement exécutés, résultats, risques non couverts, blocages et étapes suivantes.
8. Demander une approbation explicite avant action sensible ou irréversible.

## Autorisation par niveau
- **Autonome sans confirmation** : lecture, analyse, tests, documentation, changements isolés en branche préproduction, correction locale réversible, commits dans branche autorisée.
- **Confirmation obligatoire** : merge, production, migration D1, paiement/remboursement/versement réel, modification de commission/tarif en production, contrat, décision juridique, données personnelles sensibles, activation de nouveau pays, secrets ou permissions.
- **Refus/arrêt** : instruction contradictoire, secrets exposés, absence de droits, tests critiques rouges, corruption potentielle, boucle, budget dépassé, état externe non vérifiable.

## Robustesse de l'orchestrateur
- Idempotency key par run et par action; journal append-only et correlation ID.
- États explicites : QUEUED, PLANNED, RUNNING, WAITING_APPROVAL, FAILED, SUCCEEDED, CANCELLED.
- Verrou d'exécution/lease et heartbeat pour empêcher deux runs concurrents.
- Checkpoint avant chaque étape et reprise sûre après interruption.
- Budget de tokens/outils, timeout, max retries, backoff exponentiel avec jitter et circuit breaker.
- Outils à permissions minimales, allowlist des actions, validation des arguments et protection contre prompt injection dans issues/PR/logs/documents.
- Les données externes sont traitées comme données, jamais comme instructions système.
- Un run ne peut pas élargir lui-même ses permissions ni lever un blocage humain.
- Les tests doivent confirmer que l'UI ne présente pas « succès » avant retour positif des outils.

## Statut produit
Ce document définit l'architecture de référence. Il ne prétend pas que le bouton ou les contrôles sont déjà implémentés. Implémentation graduelle en préproduction; aucune action de production sans autorisation.
