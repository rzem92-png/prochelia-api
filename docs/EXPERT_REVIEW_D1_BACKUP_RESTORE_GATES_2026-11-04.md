# Revue experte D1 backup / restore / migrations — 2026-11-04

## Résultat
**NO-GO pour exécuter les workflows de migration/restauration tant que les écarts ci-dessous ne sont pas corrigés et revalidés.** Cette revue est documentaire et n'a exécuté aucune commande Cloudflare, migration, restauration ou déploiement.

## P0 — Configuration Wrangler incompatible avec le workflow de migration
Le workflow `.github/workflows/apply-preview-d1-migrations.yml` exige dans `wrangler.jsonc` :
- Worker `prochelia-api-staging`
- D1 `prochelia-preview-db`
- UUID `6adb95e5-e542-4bec-9008-fbea01042305`

Or la configuration lue sur la branche QA indique :
- Worker `prochelia-api`
- D1 UUID `04f52830-ef5a-4f17-a640-42bbc2381bba`
- aucune propriété `database_name` dans l'entrée D1.

Le contrôle Python du workflow devrait donc échouer avant migration (ce qui est préférable à une écriture sur une cible non confirmée). Ne pas retirer ce garde-fou pour faire passer le workflow. Créer/valider une configuration staging explicite et isolée, et faire confirmer l'UUID depuis Cloudflare avant toute migration.

## P0 — Export backup et cible Wrangler
Le workflow `backup-preview-d1.yml` lance `wrangler d1 export` sans checkout ni fichier de configuration explicite. À vérifier/corriger pour que Wrangler puisse résoudre le binding et la cible exacte. Exiger un contrôle préalable nom + UUID et config staging, puis exporter seulement cette base. Ne jamais faire confiance au nom seul.

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
