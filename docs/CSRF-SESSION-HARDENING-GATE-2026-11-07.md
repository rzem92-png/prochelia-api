# PROCHÉLIA — sécurité de session et recette CSRF (préproduction)

Date de revue : 2026-11-07  
Branche : `preprod/r2-eu-binding-isolated-2026-11-07`  
Périmètre : Worker API, sessions cookie cross-origin, routes mutantes.

## Décision de sécurité

**Bloquant avant production : contrôle CSRF explicite des mutations authentifiées par cookie.**

État observé dans `src/index.js` :
- Cookie de session `HttpOnly; Secure; SameSite=None` (nécessaire au front cross-origin actuel).
- La fonction `securityOriginAllowed` accepte les requêtes sans en-tête `Origin` pour permettre des clients non navigateur.
- La liste CORS accepte `X-CSRF-Token` en preflight, mais l’acceptation de cet en-tête ne prouve pas que le token est généré, lié à la session et validé côté serveur.
- Le contrôle d’origine seul ne protège pas tous les clients qui omettent Origin. Il ne faut pas considérer CORS comme un mécanisme CSRF.
- Ne pas modifier le comportement avant d’identifier les routes publiques (login, bootstrap, webhooks, health) et les routes mutantes authentifiées. Éviter de bloquer les intégrations API non navigateur légitimes.

## Implémentation attendue

1. Cartographier toutes les routes mutantes : POST/PUT/PATCH/DELETE, y compris les handlers finance, v7, Copilote et jobs.
2. Définir une politique explicite :
   - routes publiques : allowlist exacte, méthode + payload validés, rate-limit, pas de cookie privilégié;
   - webhooks PSP : signature PSP vérifiée, exemptés du CSRF navigateur uniquement par route;
   - mutations avec session cookie : Origin obligatoire et allowlist exacte, plus token CSRF lié à la session;
   - API machine-to-machine : authentification dédiée (secret/token non cookie), jamais exemption globale « Origin absent ».
3. Générer un token CSRF cryptographiquement aléatoire au login/session creation; stocker uniquement son hash si persistance; le remettre au client par mécanisme lisible par JS (endpoint protégé ou cookie non-HttpOnly dédié selon architecture).
4. Valider token + session + Origin pour chaque mutation cookie-auth; comparaison constante du token; rotation au login et révocation au logout.
5. Rejeter par défaut les mutations inconnues ou routes non classifiées.
6. Ajouter logs d’audit sans enregistrer les tokens, cookies, mots de passe, secrets ou données sensibles.
7. Garder la configuration CORS stricte : origines exactes, credentials uniquement pour origines autorisées, aucune wildcard avec credentials.

## Matrice de tests d’acceptation (automatisée)

| Cas | Attendu |
|---|---|
| Mutation session valide + Origin autorisée + CSRF valide | Acceptée si rôle et règles métier valides |
| Mutation cookie sans Origin | 403 |
| Mutation cookie Origin non autorisée | 403 |
| Mutation cookie sans CSRF | 403 |
| Mutation cookie CSRF incorrect/expiré | 403 |
| Mutation cookie CSRF d’une autre session | 403 |
| GET avec cookie et Origin valide | Lecture autorisée selon RBAC |
| Login sans CSRF initial | Fonctionne selon politique login, rate-limit + anti-bruteforce |
| Logout | Session révoquée et token invalidé |
| Webhook Stripe signature valide | Accepté indépendamment du CSRF navigateur |
| Webhook signature invalide | 400/401, aucune mutation métier |
| OPTIONS preflight | 204 uniquement origine/méthode/en-têtes autorisés; aucune requête D1 métier |
| M2M sans Origin mais authentification dédiée valide | Autorisé uniquement sur routes M2M déclarées |
| M2M sans auth | 401 |
| Route mutante non répertoriée | Refusée |

## Non-régression obligatoire

- Login/logout, /api/auth/me, bootstrap admin, sessions multi-rôles.
- Stripe webhook (signature et idempotence).
- D1 : aucun changement de schéma ou migration dans cette tâche.
- CORS frontend Pages → Worker.
- Les routes de mission restent fail-closed tant que ownership/RBAC/idempotence et validation métier ne sont pas démontrés.

## Conditions de sortie

- [ ] Implémentation revue par un second regard.
- [ ] Tests unitaires et intégration passent sur CI.
- [ ] Recette browser réelle sur iOS Safari, Android Chrome et desktop.
- [ ] Tests négatifs CSRF ci-dessus prouvés.
- [ ] Aucun secret dans les logs, artefacts, captures ou commits.
- [ ] Production reste verrouillée jusqu’à approbation humaine distincte.

**Ce document est une analyse/gate, pas une preuve que CSRF est déjà implémenté.**
