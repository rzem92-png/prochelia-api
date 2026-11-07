# Décision d’intégration V14.5.7 — audit technique

Date : 2026-11-07
Branche de référence : `staging-prochelia-v14`
Branche candidate : `prelaunch/v14.5.7-consolidation-audit`

## Résultat du compare Git
- État Git : `diverged`
- Candidate : 371 commits en avance et 148 en retard sur staging.
- Merge-base : `62e30852fa0ed7813634116fc2523ec59f556099`
- Staging : `fac96a5cfe01be1f4cc01de7cc86be5f1562da74`

## Risques identifiés
- `src/index.js` candidate contient environ 1,967 lignes de modifications par rapport à staging (1,703 ajouts / 264 suppressions selon compare), ce qui touche le runtime critique.
- Candidate ajoute 5 migrations SQL (0001–0005), des workflows de sauvegarde/migration D1, des modules Nexus/Copilot/marketplace, une gateway antivirus et des tests intégration.
- La preview D1 a déjà annoncé 0001–0004 comme appliquées dans son registre. Il faut confirmer leur empreinte exacte et le schema réel avant toute migration/merge.
- Staging source / CI sont déjà divergents de cette candidate; la branche candidate a été testée sur ses propres commits mais cela ne prouve pas son fonctionnement avec staging actuel ni la DB de preview.

## Plan d’intégration sécurisée
1. Établir un diff fonctionnel par module, route et migration, et documenter les changements de contrat API.
2. Rejouer migrations 0001–0005 sur une DB SQLite jetable créée à partir de zéro; vérifier contraintes, index, triggers, idempotence et ordre de migrations.
3. Exporter le schema preview D1 sans données personnelles, comparer aux migrations candidate et valider le registre migration.
4. Rejouer tous les tests candidate + staging sur un commit de travail isolé, y compris tests de concurrence SQLite et tests d’intégration Worker/D1.
5. Tester Stripe Sandbox avec webhook signature, checkout, remboursements, disputes et idempotence, exclusivement sur données/test mode.
6. Déployer une version identifiée SHA sur preview seulement; smoke tests de health, auth, CORS, API, D1 et rollback preview.
7. Validation humaine formelle de recette avant toute autorisation production.

## Règle d’intégration
Ne pas merger 371 commits d’un coup. Préférer un portage sélectif des modules/migrations validés dans une branche dédiée, avec commits atomiques et tests correspondants. Pas de production, pas de migration D1 preview/prod, pas de secret live modifié par ce rapport.

## Go/no-go
- Préproduction staging: CI static/security green pour le SHA documenté dans l’audit.
- Candidate V14.5.7: **NOT INTEGRATED / NEEDS DIFF + DATABASE COMPATIBILITY REVIEW**.
- Production: **NO-GO** jusqu’à recette complète, backup/restore, monitoring, Stripe Sandbox E2E et validation juridique/organisationnelle.
