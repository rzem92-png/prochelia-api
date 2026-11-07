# PROCHÉLIA — audit DDL runtime / préproduction

Date : 2026-11-07  
Référence : candidate `prelaunch/v14.5.7-consolidation-audit`, source `src/index.js`  
Nature : revue statique du code ; aucune requête distante, migration ou modification Cloudflare.

## Résultat important

La consolidation précédente a supprimé le DDL runtime de la validation du schéma paiement (`ensurePaymentSchema`) et du rate limiter (vérification read-only de `sqlite_master`). **Cela ne signifie pas que l’ensemble du Worker est sans DDL runtime.**

La source monolithique contient encore des fonctions de préparation de schéma qui exécutent des `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, notamment :

- `ensureTrustPassportSchema`
- `ensureConsolidatedSchema`
- `ensureStrategicSchema`
- `ensureOperationalSchema`
- `ensureFinalHardeningSchema`
- `ensureCommercialRecruitmentSchema`
- `ensureFinanceWorkspaceSchema`
- `ensureNationalContinuitySchema`
- `ensureProcheliaMasterComplementSchema`
- `ensureCopilotSchema`
- `productionSafetySchema`

Plusieurs de ces fonctions sont appelées par des handlers ou des chemins d’administration opérationnels (profil, configuration, finance, sauvegarde, Copilote, audit). Une partie du code peut donc encore tenter de modifier le schéma D1 depuis une requête ou un endpoint.

## Risques

1. DDL exécuté par requête : latence, concurrence au démarrage, droits excessifs et comportement différent entre environnements.
2. Schéma implicite : le Worker peut tenter de « réparer » une base sans migration versionnée et auditée.
3. Déploiement partiel : certains handlers peuvent créer des tables tandis que d’autres échouent sur une base partiellement migrée.
4. Préproduction/prod : le code ne doit pas servir à faire évoluer le schéma à la volée, surtout sur la base de production.

## Correction requise avant GO

- Inventorier chaque fonction de schéma et tous ses call-sites, en classant endpoint, table/index, dépendances et risques.
- Extraire le DDL en migrations numérotées, idempotentes, testées sur D1 local.
- Remplacer chaque `ensure*Schema` runtime par un contrôle de readiness read-only (tables, colonnes, index/triggers nécessaires) qui fail-closed avec un code stable.
- Conserver les fonctions de configuration métier distinctes des migrations : les seed/configs doivent avoir un mécanisme explicite, idempotent, audité et autorisé.
- Ajouter un test CI qui empêche l’introduction de DDL dans les chemins `fetch` / `scheduled` et vérifie que les helpers runtime sont read-only.
- Valider migrations et restauration sur D1 preview avant déploiement Worker.

## Décision

**NO-GO préproduction fonctionnelle / NO-GO production** tant que cette dette DDL runtime n’est pas résolue ou explicitement confinée aux endpoints d’administration avec permissions, validation, journalisation et approbation adaptées.

Ce document ne prétend pas que la correction est intégrée : il enregistre le constat pour éviter qu’un PASS des suites ciblées soit interprété comme une certification complète du Worker.


## Mise à jour de consolidation — Trust Passport (candidate, 2026-11-07)

- Commit source : `aec93b2741fad747a3bf01c33718506db5a37672`.
- `ensureTrustPassportSchema` devient un contrôle read-only `sqlite_master` et fail-closed (`TRUST_PASSPORT_SCHEMA_NOT_READY`) au lieu de créer tables/index depuis le runtime.
- Migration candidate `0007_trust_passport_schema.sql` ajoutée ; elle reprend les deux tables et l’index lookup avec la contrainte unique existante.
- Test `tests/trust-passport-runtime-schema-migration.test.mjs` ajouté à `test:prelaunch`.
- Commits test/package : `d2edeba1b00ed532e05919453c8e02d537fe7358`, `72f44b631811408c5eed1898fb8162ec48b2fdce`.
- CI pour le commit de suite `72f44b6` : aucun status ni run retourné par l’intégration GitHub à la vérification ; **pas de PASS attribué**.
- Migration 0007 non appliquée à D1 distant. Le NO-GO reste en vigueur : autres fonctions runtime DDL, R2/backup/restore, migrations preview, Stripe sandbox E2E et recette utilisateur restent non validés.


## Consolidation candidate — commercial/recruitment + finance workspace

- Commit source : `b98b2bfdcc25fae0bfbe88807819c2226d82e7ff`.
- Les helpers `ensureCommercialRecruitmentSchema` et `ensureFinanceWorkspaceSchema` sont désormais des contrôles read-only `sqlite_master`, fail-closed si les objets attendus manquent.
- Migrations candidates `0008_commercial_recruitment_schema.sql` (7 objets) et `0009_finance_workspace_schema.sql` (7 objets) reprennent les tables/index de l’ancien helper.
- Test ajouté : `tests/commercial-finance-runtime-schema-migration.test.mjs`, dans `test:prelaunch`.
- Commits migration : `f92b9928e4c0415df3e2b77251841104445cb430`, `e07a3710cfe93e6a39659ec72df9957c6031d992`; test/suite : `eb82ac9e73893e788168e9146def77f9f1017a24`, `4f3e0735f881636257c499c98137512d072903d6`; ajustement test : `59291d30a025a6dff5b7ce80bc4bead186fca77f`.
- CI : pas de status ni run GitHub visible pour le commit suite à la dernière vérification ; aucun PASS attribué.
- Ces migrations restent candidates et non exécutées sur D1 distant. Le NO-GO demeure tant que l’audit DDL global, la CI, backup/restore, preview et E2E Stripe ne sont pas validés.

## Consolidation candidate — strategic schema

- Helper `ensureStrategicSchema` remplacé par un contrôle read-only de présence des 6 tables stratégiques, fail-closed (`STRATEGIC_SCHEMA_NOT_READY`).
- Migration candidate `0010_strategic_schema.sql` ajoutée pour les tables et index promotions, recommandations, événements commerciaux, signaux de marché, scores de valeur client et alertes.
- Test de contrat ajouté à `tests/commercial-finance-runtime-schema-migration.test.mjs` ; le test est déjà référencé dans `test:prelaunch`.
- Commits : source `bce6d00976777e058baef316b95bd6d8fd33ef16`, migration `25332632cf726dbea36c7d809d76ff87138ae0c1`, test `3756b511e2d394d3886430ddec4d66e7fbd58d94`, package `7719c7fbc46ab467e758d6ab0afe34e0207c4b19`.
- Migration non appliquée sur D1 distant. Aucune validation CI ou test d’exécution n’est revendiquée ici.
