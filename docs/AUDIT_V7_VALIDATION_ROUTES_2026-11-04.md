# PROCHÉLIA API — Audit routes V7 de validation (2026-11-04)

## Périmètre
Lecture des fichiers `src/v7-routes.js` et `src/index.js` sur `main`. Aucun endpoint appelé, aucun changement sur main, aucune migration, aucun déploiement.

## Observation importante
Dans `src/v7-routes.js`, de nombreuses routes POST appellent les fonctions V7 avec des données envoyées par le client:
- `/api/v7/check/permissions` -> `checkPermissions(body)`
- `/api/v7/check/document` -> `checkDocument(body.document)`
- `/api/v7/check/mission` et `/api/v7/check/mission-transition`
- `/api/v7/check/availability`, `/api/v7/check/conflict`
- `/api/v7/check/pricing`, `/api/v7/check/qr`
- `/api/v7/check/payment`
- `/api/v7/finance/calculate`
- `/api/v7/check/pre-mission`

Ce code est observable dans le fichier de routes. L'audit ne confirme pas encore si un middleware d'authentification/RBAC global est appliqué avant `handleV7Route`; il faut examiner le dispatcher de `src/index.js` et les fonctions `v7.js` pour trancher.

## Risque architectural
Une route de validation alimentée par des données du navigateur ne doit jamais être considérée comme autorité métier:
- le rôle/permissions doit venir de la session serveur et de la DB, pas du payload client;
- état mission, ownership, disponibilité, conflits, tarif, QR, paiement et état de vérification document doivent être recalculés ou relus côté serveur;
- les contrôles V7 peuvent fournir des messages UX mais ne doivent pas ouvrir seuls une écriture, une mission ou un paiement;
- les endpoints de calcul exposés doivent avoir validation stricte, limites de payload, rate limiting et CORS précis;
- le paiement doit se baser sur un état confirmé par PSP/webhook signé et idempotent, jamais sur une valeur client.

## Matrice de traitement
| Endpoint / domaine | Statut | Mesure requise |
|---|---|---|
| Permissions | critique à vérifier | session + rôle DB, refuser le rôle fourni par client |
| Document | critique | statut vérifié provenant du système de vérification / DB |
| Mission / transition | critique | ownership, transitions allowlist, transaction/optimistic locking |
| Disponibilité / conflit | élevé | requête DB autoritative, transaction/réservation atomique |
| Tarification | élevé | tarif serveur/versionné, calcul de frais et devise côté serveur |
| QR | critique | nonce signé/à usage unique, mission + utilisateur + TTL + anti-rejeu |
| Paiement | critique | PSP truth, webhook HMAC + timestamp/replay + idempotence durable |
| Finance/calculate | élevé | validation input, limite, éviter fuite de logique sensible/abus de calcul |

## Checklist avant toute activation
1. Confirmer la chaîne middleware et les routes réellement exposées.
2. Tests négatifs sans session, session expirée, rôle falsifié, autre propriétaire.
3. Vérifier CSRF pour endpoints cookie-authenticated, SameSite/HttpOnly/Secure.
4. Rate limits et limites de taille sur JSON.
5. Requêtes DB paramétrées; aucun SQL construit depuis client.
6. Transactions et contraintes uniques pour réservation/paiement/refund.
7. Audit log durable sans secrets/PII excessive.
8. Tests webhook signature, timestamp, replay, idempotency, doublons et concurrence.
9. Tests staging exclusivement, données fictives et Stripe sandbox.

## Décision
Ces routes ne doivent pas être qualifiées de sécurisées ou production-ready sur la seule base des validations V7. Elles sont **bloquées pour opérations métier sensibles** jusqu'à preuve du middleware et des tests ci-dessus.

Aucun correctif de code n'est appliqué dans cet audit. PR/merge, D1 et production restent en attente de validation explicite.
