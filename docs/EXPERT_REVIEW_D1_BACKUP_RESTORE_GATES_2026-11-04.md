# Revue experte D1 backup / restore / migrations — 2026-11-04

## Résultat
**NO-GO pour exécuter les workflows de migration/restauration tant que les écarts ci-dessous ne sont pas corrigés et revalidés.** Cette revue est documentaire et n'a exécuté aucune commande Cloudflare, migration, restauration ou déploiement.

## Correction de la première lecture — configuration de migration
Une vérification plus précise a confirmé que le workflow de migration fait un checkout explicite de la branche `prelaunch/v14.5.7-consolidation-audit`, et non de la branche QA. Le `wrangler.jsonc` de cette branche prelaunch contient bien le Worker `prochelia-api-staging`, la D1 `prochelia-preview-db` et l'UUID attendu `6adb95e5-e542-4bec-9008-fbea01042305`. **Le décalage avec le wrangler.jsonc de la branche QA n'est donc pas, à lui seul, une erreur de cible dans ce workflow.** Le garde-fou de cible du workflow est cohérent avec le checkout prelaunch. Ne pas modifier les UUID ni le contrôle pour « corriger » ce faux positif.

### Écart réel à vérifier : migrations
Le workflow de migration présent sur la branche prelaunch vérifie cinq fichiers de migration (0001 à 0005), tandis que le workflow de migration lu sur la branche QA vérifie quatre (0001 à 0004). Il faut conserver la liste de migration versionnée sur la branche qui est réellement checkoutée et comparer la liste complète au répertoire `migrations/` de cette branche. Ne pas exécuter une migration tant que cette liste n'est pas validée et que l'état réel de D1 n'a pas été vérifié.

## P0 — Export backup et cible Wrangler
Le workflow `backup-preview-d1.yml` ne passe pas explicitement `--config wrangler.jsonc` à `wrangler d1 export`. Il vérifie cependant via l'API Cloudflare la correspondance exacte du nom et de l'UUID avant export. L'export D1 par nom peut être pris en charge par Wrangler sans config, mais cela doit être confirmé par un run staging réel réussi avant de déclarer le backup opérationnel. Préférer passer une config staging explicite si le workflow en utilise une, sans réutiliser accidentellement la config Worker production.

## P0 — Restauration
Les workflows restore test acceptent/figent des IDs D1 dédiés, vérifient l'identité de la base, et inspectent l'archive avant import : bonnes barrières initiales. Avant d'autoriser une restauration réelle, il faut :
1. vérifier nom + UUID de la base de test via API Cloudflare ;
2. confirmer la cible vide immédiatement avant import ;
3. empêcher production et préproduction comme destinations ;
4. confirmer l'archive chiffrée et l'intégrité SQL ;
5. lancer `PRAGMA quick_check` et les contrôles de migrations/tables/volumes après import ;
6. conserver les logs sans contenu client/SQL personnel.

Le workflow `restore-preview-d1-test.yml` a un contrôle de tables post-restauration qui se contente d'exécuter la requête et affiche une phrase de succès ; il doit valider automatiquement le résultat, pas seulement afficher « vérifier ». Le contrôle de table vide pré-import doit également être strict sur le format JSON.

## P1 — Validation restore-v2 fragile
Le workflow v2 attend exactement 24 tables, 4 migrations et 55 jours fériés. Ces constantes doivent être liées à une version/migration attendue et non devenir des valeurs intemporelles. Prévoir un manifeste/version attendu ou assertions alignées sur migrations réellement présentes.

## P1 — Rétention / reprise
Les archives workflow ont 7 jours de rétention. C'est une rétention courte pour un plan de reprise. Définir une politique approuvée (durées, rotation, chiffrement, accès, suppression) et conserver une copie durable chiffrée hors artefacts GitHub Actions si le besoin de continuité l'exige. Ne jamais stocker les clés dans le dépôt ou les artefacts.

## Tests requis avant passage READY
- workflow backup manuel sur staging, run vert, archive chiffrée uniquement ;
- restore dans une D1 test vide et différente de staging/prod ;
- intégrité SQLite, migration ledger, tables, comptages et smoke tests métier ;
- test de refus si nom/UUID incohérents, cible non vide, archive trop ancienne, secret absent/invalide ;
- vérification qu'aucun workflow ne cible production ;
- revue de permissions Cloudflare minimales et masquage des secrets ;
- validation manuelle de la restauration et du rollback.

## Statut de ce document
Audit statique basé sur les fichiers de la branche QA. Aucun CI, test distant, backup, restore, migration ou déploiement n'est déclaré exécuté par cette revue.


## Mise à jour revue 2026-11-04
La comparaison des branches a corrigé le faux positif initial sur Wrangler : migration workflow checkout la branche prelaunch qui contient la config staging attendue. Le document ne constitue pas une autorisation d'exécuter les workflows. La sauvegarde/restauration doit encore passer un test réel isolé, avec preuves CI et vérification du résultat. Aucun run Cloudflare n'a été déclenché par cette revue.


## Nouveau contrôle de cohérence migrations / restore v2 — 2026-11-04

Une comparaison du workflow de migration de la branche `prelaunch/v14.5.7-consolidation-audit` avec le workflow `restore-preview-d1-test-v2.yml` de la branche QA a détecté un écart bloquant à résoudre avant un test restore v2 :

- Le workflow de migration prelaunch vérifie les migrations `0001` à `0005`, notamment `0005_security_rate_limits.sql` (V14.5.8).
- Le workflow restore v2 valide ensuite `migration_count == 4` dans `d1_migrations`.

Ce compteur est probablement obsolète si les cinq migrations sont enregistrées dans `d1_migrations`. Il faut vérifier la convention Cloudflare D1 migrations (fichier effectivement appliqué / état DB) et faire correspondre l'assertion à la manifest versionnée. Ne pas modifier la valeur mécaniquement : la restauration doit échouer si archive pré/post-migration incohérente. Le contrôle de date post-30/10/2026 ne suffit pas à prouver la version de schéma.

### Contrôle supplémentaire requis
- [ ] Comparer la liste des fichiers migration à la table `d1_migrations` attendue.
- [ ] Assert exact migration names/version (pas seulement un count), si le format Cloudflare le permet.
- [ ] Vérifier que la migration 0005 crée `security_rate_limits` et que le restore v2 exige cette table.
- [ ] Vérifier les tables/counts de référence à partir du schéma/migrations, plutôt que des constantes non documentées.
- [ ] Exécuter uniquement sur la base restore-test v2 isolée après validation de l'UUID et du contenu de l'archive.

**Statut : bloquant pour déclarer la restauration v2 validée ; aucun workflow restore ni migration lancé par cet audit.**


## Revue sécurité des PR #87 et #88 — 2026-11-04

Cette revue est statique, basée sur les patches GitHub. Elle ne remplace pas l'exécution CI/D1 et ne valide aucune mise en production.

### PR #87 — CORS, cookie de session et profils

**Points favorables observés**
- Preflight OPTIONS est traité avant rate-limit/D1.
- Origine non autorisée rejetée.
- Méthodes et headers preflight sont limités.
- Route client : le rôle client est filtré par `c.user_id` de la session.
- Route intervenant côté client : liste limitée aux profils actifs/validés et email/téléphone masqués.
- Tests couvrent ces principaux cas.

**Garde de merge à conserver**
1. Le cookie passe de `SameSite=Lax` à `SameSite=None`. Cela rend le cookie utilisable en contexte cross-site mais augmente l'importance de la défense CSRF. Avant merge, vérifier le contrôle CSRF sur chaque mutation authentifiée : token imprévisible lié à la session, validation côté serveur, Origin/Referer strict, rejet par défaut. Le simple fait d'autoriser `X-CSRF-Token` dans CORS ne prouve pas que le token est vérifié.
2. Ajouter un test CSRF négatif pour les routes sensibles (missions, profil, paiement, payout, résolution litige), et un test positif avec token valide.
3. Les routes de listing client/intervenant renvoient actuellement des listes sans pagination. Ajouter pagination bornée (limit/max + cursor) avant usage avec volumes réels ; ne pas exposer notes/adresses de client à des rôles qui n'en ont pas besoin.
4. Vérifier que le mapping de statut des clients n'affiche pas tous les statuts non-actifs comme simplement « À vérifier » si suspension/bloquage doit être explicite.
5. Contrôler que les noms/colonnes D1 de disponibilité sont conformes au schéma de la branche cible et que le filtrage des dates est timezone-aware.

**Statut PR #87 : à garder draft jusqu'à tests CSRF et pagination / revue de minimisation des données.**

### PR #88 — providers email/WhatsApp

**Points favorables observés**
- Les adapters ne journalisent pas les credentials/payloads.
- WhatsApp n'autorise que les templates.
- L'adapter indique clairement que l'idempotence Meta doit être assurée en amont.
- Tests utilisent fetch simulé et ne font pas d'envoi réel.

**Blocages avant activation**
1. Le helper HMAC PROCHÉLIA `v1=<hex>` ne doit pas être présenté comme validation des webhooks Meta. Meta WhatsApp utilise sa propre signature (notamment `X-Hub-Signature-256`, HMAC-SHA256 sur le corps brut avec App Secret) et le challenge de vérification GET. Implémenter un handler spécifique Meta, vérifier le corps brut, comparer en constant-time et gérer challenge/subscribe; ne jamais accepter la signature générique comme alternative.
2. Resend et Meta nécessitent timeout/AbortSignal et traitement de réponses non-JSON / erreurs réseau sans fuite de secret.
3. Avant appel adapter : validation et normalisation strictes des numéros, templates/langue/composants autorisés, consentement (opt-in WhatsApp), préférence/canal, quotas, dedupe durable de notification.
4. Les retries ne doivent pas réémettre de messages non-idempotents (WhatsApp) après un timeout ambigu : conserver l'état « résultat inconnu », réconciliation et politique de retry contrôlée.
5. Tester secret absent, HTTP 429, 4xx/5xx, timeout, JSON invalide, doublon, opt-out, template interdit, consentement expiré, redaction logs et event replay.
6. Garder secrets provider uniquement en Worker secrets, non dans wrangler JSON, code, logs ou frontend. Aucun test d'envoi réel sans sandbox/validation humaine.

**Statut PR #88 : provider adapters en préproduction seulement; webhook Meta non validé; pas d'activation live.**

### Synthèse décisionnelle
- PR #87 : pas de merge sans preuve CSRF côté serveur et revue pagination/minimisation.
- PR #88 : pas d'activation WhatsApp live sans webhook Meta spécifique et dedupe durable.
- Ces observations ne sont pas des tests passés. CI des patches et tests d'intégration sont requis.
- Aucun merge, secret Cloudflare, migration, message réel ou déploiement n'a été exécuté par cette revue.


## Revalidation session-cookie CSRF finding — 2026-11-05

Static inspection of PR #87 branch `integration/auth-cors-profile-routes-v1` confirms the session cookie is configured as `HttpOnly; Secure; SameSite=None`. The CORS preflight allowlist includes `X-CSRF-Token`, but inspection of the Worker source and its current CORS/profile test files did not find a CSRF token validation contract or negative tests. CORS allowlisting alone is not CSRF protection; browsers can send cross-site requests even when the attacker cannot read the response.

**Required P0 before PR #87 merge or browser-authenticated mutation enablement:**
- define a server-validated CSRF token bound to the authenticated session (or use a reviewed synchronizer/double-submit design with appropriate cookie constraints);
- reject unsafe methods when token is absent, invalid, expired, or session-mismatched;
- validate `Origin` for browser mutation requests and apply a carefully defined `Referer` fallback; reject missing origin where browser-only route policy requires it;
- test allowed origin + valid token, allowed origin + missing token, allowed origin + wrong token, disallowed origin, token/session mismatch, and mutations on missions/profiles/payment/payout/refund/dispute;
- avoid weakening the cookie or bypassing CSRF validation for convenience.

Do not treat this static finding as proof of exploitability in every route; it is a merge blocker until a consistent server-side defense and test coverage are demonstrated. No code was changed on PR #87 by this review.


## Migration manifest reconciliation — 2026-11-05

Static comparison of the prelaunch branch migration directory confirms migrations `0001_core_business_schema.sql` through `0005_security_rate_limits.sql` are present. Migration `0005` creates `security_rate_limits`, so the isolated restore workflow v2 had stale expectations (4 migrations / 24 tables).

Correction committed to the QA branch in `restore-preview-d1-test-v2.yml`:
- expected migration count: **5** (0001–0005);
- expected application tables: **25** (previous 24 + `security_rate_limits`);
- archive precheck now explicitly requires `security_rate_limits`;
- expected holiday rows remains **55**.

This is a static reconciliation only. It does **not** establish that migration 0005 was applied to the live preview D1 or that a backup/restore succeeded. Before executing restore, obtain a fresh encrypted backup after the migration, confirm the isolated target DB name+UUID, and run the manual restore workflow only with explicit confirmation. Production D1 remains prohibited.
