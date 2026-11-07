# PROCHÉLIA — audit technique préproduction (constats vérifiables)

**Date :** 2026-11-07  
**Candidat :** branche `preprod/r2-eu-binding-isolated-2026-11-07`  
**Portée :** revue statique ciblée de `src/index.js`, CI Node et Worker R2. Ce document ne constitue pas un audit de sécurité indépendant ni une autorisation de production.

## Éléments vérifiés

- La CI exécute `node --test tests/*.test.mjs` sur Node 22.
- Le dernier run disponible pour l'élargissement CI a réussi : 36 tests, 0 échec, 0 test ignoré.
- Le bootstrap administrateur exige `BOOTSTRAP_TOKEN`, compare le Bearer fourni, vérifie que la table `users` est vide, valide les champs et hash le mot de passe avant insertion.
- Le bootstrap est à usage unique selon le contrôle `COUNT(*)` observé.
- Le wrapper CORS rejette les origines non autorisées et les préflight vérifient méthodes et headers.
- `/api/missions/validate` est explicitement bloqué avec `write_enabled:false` dans le wrapper observé.
- Le Worker R2 de test est distinct de l’API principale et n’utilise pas D1 ni Stripe.

## Points à valider impérativement (non prouvés par la revue statique)

1. **Bootstrap race condition :** le `COUNT(*)` puis l'INSERT ne sont pas une transaction atomique. Confirmer l'unicité du compte gérante et traiter les requêtes concurrentes avant d'autoriser bootstrap en production.
2. **Diagnostics/readiness :** vérifier que les endpoints de readiness n'exposent pas de détails de configuration, secrets, erreurs D1, ou état sensible à un utilisateur non authentifié.
3. **CORS/CSRF :** vérifier configuration des origines en environnement, cookies `Secure/HttpOnly/SameSite`, protection CSRF effective sur toutes les mutations, et comportement sur les sous-domaines.
4. **Sessions/RBAC/tenancy :** tests systématiques d'accès croisé client/intervenant/admin, invalidation session, expiration, rotation et ownership sur chaque route.
5. **Paiements :** les indicateurs `SERVER_PRICING_POLICY` et `STRIPE_CHARGES_ADAPTER` peuvent signaler `NOT_IMPLEMENTED`; les fonctionnalités de paiement/payout doivent rester désactivées jusqu'à validation réelle. Tests sandbox nécessaires.
6. **D1 :** contraintes uniques, migrations et transactionnalité/idempotence doivent être examinées avant migration.
7. **R2 :** le cycle réel authentifié write/read/delete et l'ancien token rejeté restent à démontrer; mocks seuls ne suffisent pas.
8. **Production :** aucun GO sans restauration testée, revue sécurité, conformité et approbation humaine datée.

## Décision

**NO-GO production tant que les points bloquants ne sont pas résolus et attestés.** Ne pas exécuter de migration D1, activer Stripe live, exposer bucket R2 ou déployer le Worker principal en production sur la base de ce document.
