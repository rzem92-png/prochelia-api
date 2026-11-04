# PROCHÉLIA API — Audit ordre middleware / DDL et accès (2026-11-04)

## Finding important
Dans `handleConsolidated(request, env)`, le code détermine si la route est une route consolidée, puis exécute:
```js
if (consolidatedPath) {
  try { await ensureConsolidatedSchema(env); }
  catch (e) { return json({ ..., message: e.message }, 500); }
}
```
Cette initialisation D1 se produit **avant** le dispatch vers les handlers qui appliquent `requireAuthRole`.

Cela signifie qu'une requête non authentifiée vers l'une des routes listées peut provoquer l'exécution des fonctions de création/assurance du schéma D1 avant le contrôle d'accès. Selon le contenu exact de `ensureConsolidatedSchema`, cela peut créer une surface de déni de service, de latence, ou de changement de schéma à la demande. Ce finding est à traiter en priorité, mais impact exact à mesurer en environnement test: les statements IF NOT EXISTS sont souvent sans effet après initialisation, mais restent du travail DB déclenché par un appel public.

Routes concernées par le pré-hook: `/api/consolidated/info`, `/api/ops/dashboard`, `/api/journal`, `/api/cases`, `/api/cases/approve`, `/api/metiers`, `/api/metiers/suggest`, `/api/pricing/quote`, `/api/finance/summary`, `/api/complaints`, `/api/settings/phase`.

## Remédiation recommandée
- Ne pas effectuer de DDL dans le chemin de requête HTTP en production.
- DDL/migrations exclusivement dans une procédure CI/preproduction contrôlée et approuvée.
- Enlever le pré-hook de `handleConsolidated`; vérifier le schéma au démarrage contrôlé ou dans un healthcheck admin protégé, sans modification.
- Authentifier et autoriser avant toute opération D1 coûteuse ou toute écriture.
- Routes d'information: limiter les données retournées et confirmer si elles sont intentionnellement publiques.
- Ne pas retourner `e.message` d'erreurs DB à l'extérieur; renvoyer un code opaque et journaliser les détails sans secrets côté serveur.
- Rate limit, quotas et taille de body pour routes POST.
- Tests: appels anonymes, route non reconnue, rafale, DB indisponible, permissions insuffisantes, DDL absence de droits.

## Autres observations de cette zone
- `/api/metiers` permet les rôles gerante/entreprise/client/intervenant: confirmer que le catalogue est bien public à ces rôles et ne contient pas de données internes.
- `/api/consolidated/info` retourne phase de projet et architecture: vérifier que la phase/env ne constitue pas une information interne à divulguer.
- `pricingQuote` requiert un rôle, mais les paramètres économiques client restent contrôlables dans le payload (rapport dédié).
- Le rôle `gerante` protège `/api/settings/phase`, mais l'ordre DDL avant auth reste un défaut d'architecture.

## Limites
Audit statique du code consulté, sans invocation runtime ni mesure. Ne démontre pas une exploitation. Aucun D1, secret, configuration Cloudflare, production ou branche principale modifié.
