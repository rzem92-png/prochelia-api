# Revue ciblée ledger wallet et rate-limit — intégration candidate

Date: 2026-11-07. Analyse en lecture seule des migrations candidates 0004/0005. Aucun SQL distant exécuté.

## 1. Ledger portefeuille (0004)

Points positifs observés:
- idempotency_key UNIQUE;
- ledger immuable par triggers UPDATE/DELETE;
- mise à jour de wallet dans un trigger AFTER INSERT;
- contrôle overflow et soldes protégés (pending/reserved/paid non négatifs).

Points à vérifier/renforcer avant adoption:
- les colonnes wallets.user_id et ledger.user_id ne déclarent pas de FK vers users; l’intégrité dépend alors des contrôles applicatifs et de la suppression de compte. Ajouter une FK exige de confirmer la stratégie de conservation/archivage RGPD et les migrations existantes.
- wallets.currency est libre (pas de CHECK ISO currency); le trigger de ledger vérifie l’existence d’un wallet user/currency à l’insertion, mais l’autre trigger de solde ne vérifie que user_id. Il faut tester les cas où un utilisateur aurait plusieurs wallets/currencies avant d’accepter le code.
- transaction_id/payout_id sont nullable sans contrainte de relation; valider les règles de liaison et l’idempotence entre webhook Stripe, refund et payout.
- l’immutabilité SQL n’empêche pas un opérateur privilégié de modifier les triggers ou la table; prévoir audit/permissions/backup et contrôle de dérive.
- l’application du ledger est atomique seulement si la transaction d’insertion/trigger est utilisée. Toute écriture directe de wallet hors ledger doit être interdite/testée.

## 2. Rate-limit persistent (0005)

- Migration additive et simple, mais table seule ne garantit pas le rate-limit: vérifier le middleware, la stratégie de fenêtre, l’incrément atomique, nettoyage des buckets expirés, anonymisation/TTL des subject_hash et réponse 429/Retry-After.
- Vérifier que les appels de rate-limit utilisent un UPSERT atomique et non SELECT puis UPDATE (risque race/concurrence).
- Les workflow D1 migration/backup de la candidate ciblent un Worker et DB hardcodés; vérifier account ID, secrets, export chiffré et artefact backup avant toute migration.

## 3. Version / provenance

La migration 0005 est commentée V14.5.8 alors que la branche candidate est nommée V14.5.7. La nomenclature release doit être normalisée: soit versionner explicitement la candidate V14.5.8, soit documenter le patch, sans prétendre que V14.5.7 contient le même schéma.

## 4. Tests d’acceptation obligatoires (SQLite local, données synthétiques)

- wallet mono/multi devise et currency mismatch;
- ledger duplicate idempotency key (aucun delta dupliqué);
- ledger UPDATE/DELETE rejeté;
- transaction rollback restaure ledger et balances;
- soldes pending/reserved/paid ne passent pas sous zéro;
- overflow INTEGER rejeté;
- refund concurrent x2, payout concurrent, webhook event replay;
- rate-limit concurrent atomique, window rollover, cleanup TTL et fail-closed DB.

## Décision
**NE PAS intégrer encore** les migrations 0004/0005 dans staging tant que le code runtime et ces tests de compatibilité ne sont pas exécutés sur un clone SQLite jetable. Ce document n’est pas un avis juridique ni une validation production. Production reste NO-GO.
