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
