# V14.5.7 — runtime vs migrations: audit des conflits de schéma

Date: 2026-11-07. Analyse des sources candidate en lecture seule. Aucun code runtime, Worker ou D1 modifié.

## Constat critique confirmé

Dans `prelaunch/v14.5.7-consolidation-audit/src/index.js`, la fonction `ensurePaymentSchema(env)` contient des DDL `CREATE TABLE IF NOT EXISTS` et des triggers pour `wallets` et `payment_wallet_ledger` (occurrences relevées dans le code source). La migration candidate `0004_atomic_wallet_ledger.sql` crée elle aussi ces objets.

**Il existe donc deux propriétaires de schéma** : le code exécuté sur requête et le système de migrations. Même si `IF NOT EXISTS` évite certaines erreurs immédiates, les définitions peuvent diverger silencieusement : une migration ne modifie pas une table déjà existante, et les triggers déjà présents peuvent ne pas correspondre au code SQL de la migration.

La candidate contient également une table `security_rate_limits` dans `ensurePaymentSchema`, alors que la migration `0005_security_rate_limits.sql` la définit séparément. Le commentaire de migration 0005 annonce que le middleware ne crée plus de schéma à la volée, mais l’existence de cette DDL dans le helper paiement doit être évaluée pour confirmer si elle est encore appelée dans le chemin de requête. La séparation des responsabilités n’est pas démontrée.

## Action corrective obligatoire avant toute intégration

1. Choisir un propriétaire unique du schéma : migrations versionnées. Les fonctions runtime `ensurePaymentSchema` doivent devenir des vérifications read-only de readiness (ou être supprimées après migration), jamais exécuter CREATE/ALTER/TRIGGER en production.
2. Préparer une migration de convergence uniquement après comparaison du schema preview et des migration checksums. Ne pas tenter de corriger via `IF NOT EXISTS`.
3. Sur SQLite jetable : démarrer depuis zéro, appliquer migrations 0001–0005; comparer schema/triggers à celui attendu par runtime; démarrer une DB depuis le schéma historique et tester le chemin de migration.
4. Tester une DB préexistante avec tables wallet/ledger mais triggers différents; l’exécution répétée ne doit pas masquer la divergence.
5. Vérifier les routes qui appellent `ensurePaymentSchema` et rate-limit, puis assert qu’aucune requête API n’émet DDL.
6. Ajouter un test statique CI : bannir `CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, `ALTER TABLE` dans les handlers runtime, sauf liste explicite et documentée de migrations bootstrap.

## Décision
**Bloquant release.** Ne pas merger la candidate, ne pas appliquer de migration preview/production et ne pas activer paiements tant que les deux chemins de création de schéma ne sont pas réconciliés. C’est un risque de drift schema, pas une preuve de corruption de la base actuelle.
