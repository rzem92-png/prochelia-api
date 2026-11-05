# PROCHÉLIA — audit de séparation des migrations runtime (2026-11-05)

## Résultat de l’inspection

HEAD contrôlé : `202e1b2ed49422c471119bfa7fe785ec5818abe1` (branche `feat/supra-intelligence-governance-v1`).

Dans `src/index.js`, les fonctions suivantes contiennent ou exécutent des créations de schéma et sont appelées depuis des routes métier :

- `ensureSecuritySchema(env)`
- `ensurePaymentSchema(env)`
- `ensureConsolidatedSchema(env)`
- `ensureStrategicSchema(env)`
- `ensureOperationalSchema(env)`
- `ensureFinalHardeningSchema(env)`
- `ensureCommercialRecruitmentSchema(env)`
- `ensureFinanceWorkspaceSchema(env)`
- `ensureNationalContinuitySchema(env)`
- `ensureProcheliaMasterComplementSchema(env)`

**Risque confirmé :** plusieurs routes exécutent du DDL via ces fonctions à la demande. Ce modèle peut masquer un schéma incomplet, compliquer le rollback, provoquer des courses de création et donner à l’API runtime des responsabilités de migration.

## Principes de correction (sans modification de données)

1. Toute évolution de schéma doit être une migration SQL versionnée, revue et appliquée explicitement.
2. Les handlers métier ne doivent jamais exécuter `CREATE`, `ALTER`, `DROP` ou `CREATE INDEX`.
3. Les handlers doivent vérifier les prérequis de schéma en lecture seule et échouer de manière contrôlée si une migration manque.
4. Le contrôle de readiness doit être read-only.
5. Les migrations doivent être testées sur D1 isolée/preview avec sauvegarde chiffrée vérifiée et test de restauration.
6. Aucune migration production ne doit être déclenchée par CI ordinaire, PR, healthcheck ou appel client.
7. Déployer le code qui exige un nouveau schéma uniquement après validation de migration preview et d’un plan de rollback.

## État actuel / release gate

- La séparation complète runtime DDL → migrations explicites n’est **pas encore réalisée**.
- Ne pas prétendre que la base est migration-safe.
- Ne pas exécuter de migration production.
- Prévoir une migration par domaine, avec historique versionné et tests idempotents, avant conversion des handlers.
- Une conversion massive en une seule modification est déconseillée : découper par domaine (core → sécurité → paiements → SUPRA/ops → finance), et à chaque étape comparer les tables/index attendus, exécuter tests API et restore preview.

## Workflow de migration preview actuellement observé

Le workflow `.github/workflows/apply-preview-d1-migrations.yml` checkout la branche :

`prelaunch/v14.5.7-consolidation-audit`

Il vérifie un D1 preview précis et exporte/chiffre une sauvegarde avant application. **Ce checkout est volontairement épinglé à une branche distincte du HEAD audité** : ne pas supposer que les migrations de la PR #12 sont celles exécutées par ce workflow. Une mise à jour de cette cible nécessite une revue dédiée, pas un remplacement automatique.

## Autres release gates

- `package-lock.json` absent : l’installation CI ne garantit pas encore une résolution strictement reproductible.
- CI green signifie tests et bundling réussis, pas recette réelle, restauration testée, PSP sandbox complet ni conformité légale.
- PR #12 reste brouillon/non fusionnée tant que ces gates ne sont pas satisfaites.
