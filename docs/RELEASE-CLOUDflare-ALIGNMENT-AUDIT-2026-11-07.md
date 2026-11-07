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
