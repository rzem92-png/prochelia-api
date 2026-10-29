# PROCHÉLIA — sauvegarde et restauration R2 (préproduction)

## Périmètre et sécurité

Ce runbook concerne exclusivement le Worker `prochelia-api-staging` et la base D1 `prochelia-preview-db`. Ne pas réutiliser ces étapes pour `main`, la production, ni une base de production.

La sauvegarde logique chiffre les lignes avec AES-256-GCM avant dépôt dans R2. Les journaux `backup_runs` et `backup_objects` sont exclus des tables exportées pour éviter les sauvegardes récursives. Le contrôle d'intégrité SHA-256 stocké dans D1 permet de détecter une altération; il ne remplace pas une restauration testée.

## Configuration Cloudflare

1. Dans le compte Cloudflare du projet, créer le bucket R2 `prochelia-preview-backups` s'il n'existe pas.
2. Vérifier que le Worker de préproduction utilise `wrangler.jsonc` sur la branche `staging-prochelia-v14`; le binding `BACKUP_BUCKET` et le Cron `0 3 * * *` (03:00 UTC) sont déclarés dans ce fichier.
3. Dans les paramètres/secrets du Worker de préproduction, ajouter `BACKUP_ENCRYPTION_KEY` avec une clé aléatoire forte d'au moins 32 octets d'entropie. Ne jamais la committer, la journaliser ou la partager dans un ticket.
4. Ne pas déployer tant que le nom du bucket, le compte Cloudflare, le binding D1 et le secret n'ont pas été contrôlés.

## Contrôle après déploiement volontaire en préproduction

1. Authentifié avec un compte Gérante de préproduction, appeler `GET /api/system/backups`. La réponse `configured` doit être `true`; si elle est `false`, arrêter la recette.
2. Déclencher une sauvegarde manuelle via `POST /api/system/backup/run` uniquement en préproduction, puis vérifier `ok: true`, `status: "COMPLETED"`, un nombre d'objets supérieur ou égal à 1 si la base contient des tables, et la présence des objets dans R2.
3. Contrôler dans D1 les lignes `backup_runs` et `backup_objects`, les tailles et les empreintes. Ne pas exposer les lignes ou documents sauvegardés dans les journaux.
4. Attendre le prochain Cron (03:00 UTC) et confirmer une exécution `AUTOMATIC` dans `backup_runs`. Une configuration de Cron seule ne prouve pas qu'il a été exécuté.
5. Configurer et documenter séparément la politique de cycle de vie R2 pour le bucket de préproduction. La valeur `retentionDays: 90` affichée par l'API est une information de politique, pas la preuve qu'une règle de purge R2 existe.

## Recette de restauration — blocage avant production

Le Worker expose actuellement un déclenchement de sauvegarde et un état des exécutions; cela ne suffit pas à prouver qu'une restauration complète et sûre est automatisée. La restauration doit être testée par une procédure contrôlée sur une base D1 temporaire et isolée, sans écraser la base de préproduction ni la production :

- sélectionner un jeu de sauvegarde identifié et vérifier chaque checksum;
- déchiffrer avec la clé de sauvegarde conservée dans le gestionnaire de secrets;
- reconstruire le schéma dans une base D1 temporaire compatible;
- réimporter les tables dans l'ordre des dépendances et vérifier les comptes de lignes;
- vérifier les relations essentielles et les parcours applicatifs non financiers;
- documenter la durée, les écarts, l'intégrité et la décision de validation;
- supprimer la base temporaire selon la procédure d'exploitation une fois la recette approuvée.

Ne jamais tester une restauration en écrasant une base active. Si le déchiffrement, les checksums ou les comptages échouent, déclarer l'essai en échec et ne pas valider la sauvegarde.

## Critères de sortie

- [ ] Bucket R2 réellement créé et accessible par le Worker de préproduction.
- [ ] Secret `BACKUP_ENCRYPTION_KEY` configuré sans fuite.
- [ ] Sauvegarde manuelle terminée et objets présents.
- [ ] Cron observé après son déclenchement réel.
- [ ] Politique de cycle de vie R2 configurée et vérifiée.
- [ ] Restauration D1 isolée exécutée avec contrôles de cohérence.
- [ ] Rapport de recette archivé.

Tant que ces contrôles ne sont pas tous réussis, la sauvegarde/restauration n'est pas considérée comme validée pour la production.
