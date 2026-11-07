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

## Consolidation candidate — final hardening schema

- `ensureFinalHardeningSchema` devient un contrôle read-only et fail-closed (`FINAL_HARDENING_SCHEMA_NOT_READY`) pour 5 tables.
- Migration candidate `0011_final_hardening_schema.sql` créée pour configuration-checks, idempotency, background jobs, rate limits et registry d’intégrations.
- Test de non-DDL ajouté au fichier de tests runtime-schema déjà présent dans `test:prelaunch`.
- Commits source `1a3b2061a4291e6d36f3de70f76aef644a741b29`, migration `02eadd54615eb08c739232a26186fa5f855c54b3`, test `5449a5c627ea32119c09bfa5873431e67fc78f7a`.
- Non exécuté sur D1 distant ; CI/tests restent à vérifier.

## Consolidation candidate — national continuity / backups

- `ensureNationalContinuitySchema` devient read-only/fail-closed (`NATIONAL_CONTINUITY_SCHEMA_NOT_READY`).
- Migration `0012_national_continuity_schema.sql` porte les tables backup/scale config, indexes et defaults d’échelle. Les defaults sont initialisés dans la migration, plus dans le handler.
- Test ajouté au fichier de contrat runtime schema (déjà référencé dans `test:prelaunch`).
- Commits source `f4ed42dd6e9a58d8daa32e10b6ff2a519cce8fe7`, migration `5e0001bb929ccf1cc78cc2b1bbf4f6849e3ebedb`, test `8b0e8c97d2a7f930a85e6fb00a9d7860cc854091`.
- Migration candidate, non appliquée sur D1 distant. R2 non activé et sauvegarde/restauration non vérifiées : ce changement n’établit pas de backup opérationnel.

## Consolidation candidate — master complement schema

- `ensureProcheliaMasterComplementSchema` ne contient plus de DDL runtime ; contrôle read-only fail-closed (`MASTER_COMPLEMENT_SCHEMA_NOT_READY`).
- Migration `0013_master_complement_schema.sql` créée pour les tables/index branding, profils d’interface et support/Copilote.
- Les insertions idempotentes des paramètres de marque, profils et règles restent explicitement séparées du DDL dans le helper (préservation du comportement métier).
- Commits source `7630a34f2d4f3fac2e4106f040f74879f0204370`, migration `ed8640fbdcfa941b0f45d4859d9e443cea94320f`, test `9e06d6943d5c34359d1b8d494ae182ed4e7da5dc`.
- Migration non appliquée sur D1 distant. Les insertions seed au runtime nécessitent encore une revue de droits/transaction et ne constituent pas une migration exécutée.

## Consolidation candidate — operational schema

- `ensureOperationalSchema` : suppression du DDL runtime et des `ALTER TABLE` opportunistes ; contrôle read-only des tables et colonnes `action_outbox.case_id/processed_at`, fail-closed (`OPERATIONAL_SCHEMA_NOT_READY`).
- Migration candidate `0014_operational_schema.sql` reprend les tables/index opérationnels et inclut les deux colonnes attendues dès la création.
- Test de contrat ajouté à la suite prélaunch.
- Commits source `fd277c9039a2a12dcba64732412c8e0d0daef854`, migration `367709c77175a6b98eb577082e0741f4d91da210`, test `38beb3dcfcaedd1d660d51ea786631db64ccad3b`.
- Migration non appliquée à D1 distant ; aucun PASS CI attribué.

## Consolidation candidate — production safety events

- `productionSafetySchema` désormais vérifie uniquement la présence de la table, avec fail-closed `PRODUCTION_SAFETY_SCHEMA_NOT_READY`.
- Migration candidate `0015_production_security_events.sql` ajoutée.
- Test de contrat ajouté au test runtime-schema.
- Commits source `fd5326ff1f5b77b24ab6cfb000de62efa2efed85`, migration `63e218bc8530e8f44936cb7cadfcf442d8e0061a`, test `03ad57c04f2d1112cdb1695d2d2eb8223cd6d700`.

## Consolidation candidate — identity/mission/document security

- Helpers `ensureSecuritySchema` et `ensureDocumentSecuritySchema` remplacés par readiness checks read-only, fail-closed.
- Migrations candidates `0016_security_identity_schema.sql` et `0017_document_security_scans.sql` créées.
- Tests de contrat ajoutés à la suite prelaunch.
- Commits : identity source `e14e2b7e7cf32888a7b2b7bf2f84488d003efaa8`, migration `582b670429bee0a9ccd3c6c17e10ed18cc681b3f`; document source `9a145b011cf981ccadfc0a271e88ff90b9e94e27`, migration `837d9d53eb53d825622308b0f0918f0446d771f7`; tests `ddf2260743e678286776ae50592e646324a1652e`.
- Migrations non exécutées sur D1 distant. CI n’a pas retourné de status.

## Consolidation candidate — consolidated business/pricing schema

- `ensureConsolidatedSchema` remplacé par un contrôle read-only fail-closed (`CONSOLIDATED_SCHEMA_NOT_READY`).
- Migration candidate `0018_consolidated_business_schema.sql` reprend 21 tables et indexes, les paramètres de plateforme et les 55 dates fériées de 2026–2030.
- Ordre de création corrigé : l’index `idx_pricing_route_owner_expiry` est créé après la table cible.
- Test de contrat ajouté. Commits source `7e78f2b65bf941e64b2a774e78d4b1537d1c3a8f`, migration initiale `0d87b1385473a60501b62b13eb25f5578fa36b69`, correction ordre `5228b8f94eeca825a1af1aca3cf2d7ed73d1437d`, test `4e073632f317a65dac48638de8ddb058134ca601`.
- Migration non exécutée sur D1 distant ; validation SQL/CI à effectuer.
