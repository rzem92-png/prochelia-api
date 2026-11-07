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
