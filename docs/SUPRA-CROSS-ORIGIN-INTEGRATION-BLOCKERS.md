# SUPRA — blocages d'intégration navigateur avant préproduction

État vérifié sur la branche `feat/supra-intelligence-governance-v1` et le front `feat/supra-control-center-v1`.

## Constat vérifiable

1. Le centre SUPRA appelle directement l'API avec `fetch(..., { credentials: "include" })`.
2. Le cookie de session API est émis avec `HttpOnly; Secure; SameSite=Lax`.
3. Les origines Pages et Workers utilisées pour les previews sont des sites distincts. Un cookie `SameSite=Lax` n'est pas envoyé lors d'un `fetch` intersite ; le navigateur peut donc ne pas transmettre la session Gérante.
4. Le Worker contrôle l'origine des requêtes mutantes via `securityOriginAllowed`, mais le code inspecté ne renvoie pas de contrat CORS avec `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Vary: Origin` et ne traite pas le préflight `OPTIONS`.
5. La liste d'origines par défaut du contrôle de sécurité ne contient pas l'URL de preview de branche `https://feat-supra-control-center-v1.prochelia.pages.dev`. Une configuration explicite ne doit contenir que les origines nécessaires, sans joker.
6. Le front bloque volontairement tout repli vers l'API de production et exige `supraApiBaseUrl`. Ce comportement est conservé.

## Conséquence

La réussite des tests unitaires et du bundle Worker ne prouve pas que le navigateur peut établir une session authentifiée entre Pages et Workers. Le parcours SUPRA réel ne doit pas être déclaré validé tant que ce point n'a pas été traité et testé sur Safari iOS et sur un navigateur desktop.

## Solution d'architecture recommandée

Préférer un point d'entrée API same-site sous un domaine contrôlé par PROCHÉLIA (par exemple `app.` et `api.` sous le même domaine enregistrable, ou un proxy Pages Functions same-origin). Cela évite de dépendre des cookies tiers, souvent restreints par les navigateurs.

Si une architecture intersite est retenue malgré tout, elle doit faire l'objet d'une conception sécurité séparée : CORS à origine exacte avec credentials, préflight OPTIONS, cookie compatible avec le contexte, contrôle Origin/CSRF sur toutes les mutations, et tests Safari/iOS. Ne pas simplement ajouter `Access-Control-Allow-Origin: *` ni désactiver les contrôles CSRF.

## Conditions de levée du blocage

- [ ] Domaine/API de préproduction distincts de la production et configuration same-site validée.
- [ ] D1 de préproduction dédiée, identifiant confirmé ; aucun identifiant de production réutilisé.
- [ ] Secrets et stockage de préproduction distincts.
- [ ] Session Gérante créée, lue et révoquée depuis Safari iOS et desktop.
- [ ] Tests CORS/CSRF, origine interdite, préflight, cookie et expiration.
- [ ] Parcours navigateur réel : connexion, chargement des domaines, création d'un plan, refus 401/403 et absence de fallback production.
- [ ] Aucun déploiement ni migration avant validation de ces contrôles.

## Limite actuelle

Ce document consigne un blocage identifié dans le code ; il ne prétend pas qu'une configuration Cloudflare ou une intégration navigateur a été modifiée. Aucune requête à la base de production n'est requise pour lever ce blocage.
