# PROCHÉLIA — contrôle d'alignement release / Cloudflare
Date de vérification : 2026-11-07
Branche candidate : `prelaunch/v14.5.7-consolidation-audit`
Commit vérifié : `4db358b2914b4f0e80859fed4feeede196f6ea89`

## CI candidate
- Suite de régression : PASS (run 42395647091, SHA `4db358b`).
- Audit pré-lancement : PASS (run 42395646773, SHA `4db358b`).
- D1 migrations tests : PASS (run 42395638437, SHA `cd205fcc`, contient migration 0005).
- Workers + local D1 integration : PASS (run 42395638448, SHA `cd205fcc`, contient les changements Worker de pruning).
- Les tests CI ne constituent pas un déploiement, une recette Stripe réelle ni une migration distante.

## État Cloudflare constaté en lecture seule
Compte Cloudflare interrogé en lecture seule le 2026-11-07 :
- Worker `prochelia-api-preview` : dernier déploiement observé le 2026-11-06 à 07:21 UTC, annoté `PROCHÉLIA V14.0.0 staging payment-route wiring`, version 6; binding D1 `6adb95e5-e542-4bec-9008-fbea01042305` (preview).
- Worker `prochelia-api` : dernier déploiement observé le 2026-10-31 à 10:38 UTC, binding D1 production `04f52830-ef5a-4f17-a640-42bbc2381bba`.
- Worker `prochelia` : dernière mise à jour observée le 2026-11-06 à 10:52 UTC, binding D1 production.
- Aucun Worker nommé `prochelia-api-staging` n'apparaissait dans l'inventaire de scripts retourné.

## Décision de release
**NO-GO production / NO-GO migration D1 distante.**
La candidate V14.5.7 n'est pas identifiée comme déployée sur un Worker de préproduction. L'écart entre le nom du Worker configuré par la branche candidate (`prochelia-api-staging`) et le Worker Cloudflare existant (`prochelia-api-preview`) doit être résolu avant tout déploiement.
Ne pas rediriger, renommer, remplacer ou déployer sur un Worker existant sans validation explicite du nom cible, du binding D1 et de la stratégie de rollback.
Aucune écriture Cloudflare, aucun déploiement Worker et aucune migration D1 distante n'ont été exécutés pendant cet audit.

## Prochaine condition vérifiable
1. Confirmer la cible Worker staging/preprod (nom exact + domaine workers.dev/route).
2. Faire correspondre le code source déployé au SHA candidat et confirmer son binding preview D1.
3. Exécuter la migration 0005 uniquement après sauvegarde chiffrée fraîche, vérification restauration et validation explicite de l'environnement preview.
4. Recette réelle Stripe Sandbox (checkout, signature webhook, idempotence, refund, dispute) et journeys clients/intervenants.
5. Seulement ensuite, revue de lancement et décision humaine production séparée.

## D1 preview — vérification distante en lecture seule
Base preview `6adb95e5-e542-4bec-9008-fbea01042305`, interrogée sans écriture :
- Migrations enregistrées : `0001`, `0002`, `0003`, `0004`.
- Migration `0005_security_rate_limits.sql` : **non appliquée**.
- Table `security_rate_limits` : **absente**.
- La requête d'inventaire a retourné `changed_db=false` et `rows_written=0`.

**Conséquence :** le candidat qui active le rate limiter persistant doit rester non déployé sur ce Worker tant que la migration 0005 n'est pas installée sur le D1 preview. Avec le garde-fou actuel, les requêtes mutantes seraient refusées avec 503 plutôt que d'écrire dans un schéma absent. C'est le comportement de sécurité attendu, mais cela bloque la recette fonctionnelle.

## R2 — blocage constaté
La liste des buckets R2 Cloudflare a répondu HTTP 403 / code 10042 : R2 doit d'abord être activé dans le Dashboard Cloudflare. Aucun bucket n'a été créé et aucun objet n'a été écrit.
La sauvegarde chiffrée fraîche, nécessaire comme précondition à la migration D1 preview, ne peut donc pas être attestée à cette date.
