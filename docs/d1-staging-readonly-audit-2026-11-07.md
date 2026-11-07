# Audit D1 préproduction — lecture seule

Date de contrôle : 2026-11-07 (UTC à confirmer côté opérateur).  
Base ciblée : `prochelia-preview-db` — UUID `6adb95e5-e542-4bec-9008-fbea01042305`.  
**Aucune écriture, migration, suppression ou restauration n'a été effectuée.**

## Résultats observés via Cloudflare D1 API
- Tables (hors sqlite internes) : **25**.
- Index (hors sqlite internes) : **18**.
- `d1_migrations` existe et contient **4** entrées : `0001_core_business_schema.sql`, `0002_server_pricing.sql`, `0003_route_address_provenance.sql`, `0004_atomic_wallet_ledger.sql` (30/10/2026).
- Tables principales présentes : `users`, `clients`, `intervenants`, `missions`, `paiements`, `payment_wallet_ledger`, `wallets`, `sessions`, `prestations`, `tarifs`.
- `PRAGMA foreign_key_check` : résultat vide (aucune violation retournée).
- Taille D1 annoncée par l'API lors de la lecture : **335 872 octets**.
- `PRAGMA integrity_check` : **non exécuté avec succès**; Cloudflare API a retourné `SQLITE_AUTH`. Ce résultat ne prouve ni corruption ni intégrité complète.

## Interprétation
- La base staging existe et contient un schéma non trivial; ne pas la remplacer ni réinitialiser.
- Les 4 migrations enregistrées ne prouvent pas à elles seules que le schéma courant correspond à la version du code Worker.
- Les résultats de foreign-key-check ne remplacent pas les tests applicatifs, l'inventaire des contraintes, ni une restauration vérifiée.
- Aucun contenu métier, email, téléphone, token ou donnée personnelle n'a été extrait dans ce rapport.

## Suite bloquante avant release
1. Export D1 de staging et restauration dans une base isolée.
2. Comparaison exhaustive de `sqlite_master`, colonnes, contraintes, index et versions de migration avec les attentes du Worker.
3. Tests applicatifs sur base clonée et plan de rollback.
4. Vérification `integrity_check` via une voie autorisée (Cloudflare dashboard/CLI ou export local).
5. Refaire ces étapes sur l'environnement production séparé avant tout déploiement.

**Statut : audit de lecture staging effectué; D1 production et intégrité globale restent non certifiées.**

## Worker preview — inspection configuration en lecture seule
- Worker identifié : `prochelia-api-preview` (annotation : preview-only).
- Binding `APP_ENV=preview`.
- Binding D1 `DB` pointe vers l'UUID staging attendu `6adb95e5-e542-4bec-9008-fbea01042305`.
- `CORS_ORIGIN` inclut les deux domaines Pages staging déclarés.
- Subdomain workers.dev activé et previews activées.
- Observability globale `enabled=false` (les logs d'invocation sont indiqués enabled/persist=true).
- Liste de bindings secrets Worker retournée vide. Les clés Stripe et autres secrets ne sont donc pas confirmés présents sous forme de secret Worker. Ne pas injecter de clé live; configurer sandbox via secret store et vérifier le secret sans jamais afficher sa valeur.
- Test HTTP externe du Worker depuis l'environnement d'outils bloqué par politique réseau (`403 requests ... are not allowed`); aucune réponse health endpoint n'est certifiée depuis ce contrôle.

## Version/source drift — release blocker
- Staging branch `staging-prochelia-v14` source reports `V14.5.1-EXPERT-PREPRODUCTION` in `src/index.js`.
- Cloudflare Worker `prochelia-api-preview` configuration annotation reports a deployed preview described as `V14.0.0` (staging payment-route wiring), last modified 2026-11-06 07:21 UTC. This indicates deployed preview and Git branch need reconciliation; deployment SHA was not proven.
- A separate branch `prelaunch/v14.5.7-consolidation-audit` contains source `V14.5.7-EXPERT-PREPRODUCTION` and the four SQL migration files named by the staging D1 migration ledger. Do not cherry-pick or deploy it blindly: its source/schema contract must be reviewed against the present staging branch and D1.
- The preview Worker API returned no configured secret bindings. Secrets may be managed elsewhere, but they are not confirmed in this Worker. Verify sandbox secret setup in Cloudflare without exposing values.
- Stripe adapter regression test now imports `src/stripe-adapter.js` (the actual source module referenced by `src/index.js`) rather than the root legacy copy.
- CI static validation was expanded to syntax-check `src/stripe-adapter.js`, `src/v7.js`, `src/v7-routes.js`, and verify Wrangler `main` plus local imports. Workflow run result for the new commit must be checked in Actions before release.

## CI staging — vérification post-corrections
Commit contrôlé : `74e1e3a3cde3aae625ad43ac0cafa0ee88e78164`.
- Workflow `PROCHÉLIA preproduction static validation` #204 : **success**.
- Workflow `PROCHÉLIA Security Origin Regression` #121 : **success**.
- Logs du job de tests Node 22 : **67 tests, 67 réussis, 0 échoué**.
- Les tests Stripe adaptateur importent désormais `src/stripe-adapter.js` (la source applicative), et non la copie racine.
- Ces tests sont des tests Node/contractuels et certains contrôles statiques; ils ne remplacent pas une recette API/Stripe/D1 de bout en bout.
