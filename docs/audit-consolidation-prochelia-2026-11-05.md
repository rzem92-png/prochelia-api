# Audit de consolidation PROCHÉLIA — 2026-11-05

## Résultat vérifié sur `main`
- API entry point : `src/index.js`, Worker Cloudflare.
- Wrangler `wrangler.jsonc` actuellement lié à la D1 de production (database_id `04f52830-ef5a-4f17-a640-42bbc2381bba`). Ne pas utiliser cette configuration pour des tests/migrations.
- Auth existante : session cookie `prochelia_session`, hash PBKDF2 100 000 itérations, sessions D1.
- `POST /api/missions` est désactivé (fail-closed); validation mission non authentifiée est refusée.
- Des modules de sécurité, paiements, webhooks, payouts, litiges et audit existent déjà dans `src/index.js`. Nexus/SUPRA doit s’intégrer en additif et réutiliser les modules existants, pas les dupliquer.
- V7 routes sont montées via `handleV7Route` depuis `src/v7-routes.js`.
- PR #87 (auth/CORS/profils) et PR #89 (idempotence payout) sont encore ouvertes. Les états doivent être revérifiés avant toute intégration; ne pas considérer leur contenu comme dans main.
- Aucun endpoint Nexus n’a été confirmé dans le segment de routeur principal inspecté. L’audit n’a pas encore couvert intégralement toutes les routes et migrations.

## Risques/contrôles avant intégration
1. **Configuration production** : séparer wrangler preview/prod par environnement; tests D1 uniquement sur base preview.
2. **Sessions/CORS** : vérifier l’alignement de `SameSite`, origine frontend, credentials et CSRF selon architecture réellement choisie.
3. **Paiements** : webhook replay, transitions terminales, double crédit wallet, remboursements concurrents et ledger doivent être testés avec D1 preview et sandbox PSP.
4. **Données métier** : vérifier les tables et index existants avant toute migration. Aucun `CREATE TABLE`/migration Nexus en prod.
5. **Nexus vertical slice** : profil talent adulte, offre, disponibilité, demande de réservation, collision horaire, ownership/RBAC, audit événementiel. Pas de fonctionnalités payantes mineurs dans cette tranche.
6. **SUPRA** : moteur de détection/assistance + journal d’audit. Résolution automatique seulement déterministe, autorisée, réversible et idempotente. Toute action financière, contractuelle, réputationnelle, sécurité ou touchant un mineur doit demander confirmation humaine ou revue.
7. **Release** : tests unitaires, CI, Worker dry-run, tests preview D1, navigateur, sécurité, sauvegarde/rollback et feu vert explicite avant prod.

## État exact
- Cet audit est documentaire et non exhaustif.
- Aucune migration, écriture D1, fusion ou mise en production effectuée.
- Les schémas proposés dans le blueprint Nexus restent hypothétiques jusqu’à comparaison exhaustive avec la base existante.
