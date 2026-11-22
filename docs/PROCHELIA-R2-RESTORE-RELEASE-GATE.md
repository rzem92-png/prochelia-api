# PROCHÉLIA — D1 / R2 Preview restore and release gate

Audit consolidé au 22 novembre 2026. Ce document corrige explicitement le constat antérieur : un 404 obtenu sans la juridiction R2 EU ne prouve pas que le bucket EU est absent.

## R2 — état observé et limites de lecture

Le Worker `prochelia-api-preview` déclare le binding :

- `BACKUP_BUCKET`
- bucket `prochelia-preview-backups-eu-v2`
- juridiction `eu`

L'API R2 doit être interrogée avec l'en-tête `cf-r2-jurisdiction: eu`. La connexion de contrôle utilisée lors de cet audit ne permet pas de transmettre cet en-tête personnalisé. Les lectures effectuées dans la juridiction par défaut ont retourné 404 ; elles ne permettent donc pas de conclure que le bucket EU est absent. **Ne pas créer de bucket de remplacement et ne pas rediriger le binding.**

Lecture R2 explicite réalisée le 22 novembre avec `cf-r2-jurisdiction: eu` : le bucket existe, `jurisdiction=eu`, région `EEUR`, classe Standard. Six objets ont été listés : trois fichiers `.sql.gpg` et leurs trois manifestes `.sha256`, tous datés du 17 novembre. La lecture du bucket Lock retourne `rules=[]` : aucune règle Object Lock n'est configurée.

### Conditions pour valider R2

1. Lire le bucket avec `cf-r2-jurisdiction: eu` et confirmer son nom, sa juridiction et sa région.
2. Inventorier les objets, dates, tailles et métadonnées ; vérifier la cohérence des trois exports historiques.
3. Vérifier les règles Object Lock et la rétention. À ce jour, aucune règle de verrouillage effective n'est démontrée.
4. Confirmer la présence et l'accès contrôlé au secret `BACKUP_ENCRYPTION_KEY` ; ne jamais exposer sa valeur.
5. Produire un backup chiffré de la seule D1 Preview, avec checksum et identifiant de version de clé.
6. Télécharger l'objet, vérifier le checksum, déchiffrer dans un environnement isolé et restaurer dans une nouvelle base SQLite.
7. Exiger `PRAGMA integrity_check` = `ok` et `PRAGMA foreign_key_check` sans résultat.
8. Documenter l'identité DB, le registre de migrations, la date, l'objet, le checksum, la version de clé, le résultat de restauration, le RPO et le RTO.


### Interprétation des manifestes R2 existants

Le workflow `.github/workflows/backup-preview-d1-to-r2-eu.yml` calcule `plain.sha256` sur le dump SQL avant chiffrement, copie ce digest dans `manifest.sha256`, puis téléverse le fichier chiffré et le manifeste. Le workflow de round-trip compare le fichier chiffré téléchargé à l'original, déchiffre ensuite et compare le SHA-256 du SQL restauré au manifeste. Un SHA-256 calculé directement sur le `.sql.gpg` ne doit donc pas égaler le digest du manifeste : ce serait comparer le ciphertext au plaintext. Les trois sauvegardes historiques n'ont pas été déchiffrées/restaurées pendant ce contrôle ; leur validité reste à démontrer avec le secret autorisé, sans exposer sa valeur.

## D1 Preview — écart entre CI et environnement partagé

La D1 Preview liée au Worker partagé est `prochelia-preview-eu-2026-11-17`, UUID `e3cf167c-37e1-4d72-9ac6-b3e27c14b97f`, juridiction EU.

La dernière lecture SQL consignée confirme :

- 23 migrations enregistrées, de `0000` à `0022` inclus ;
- les migrations candidates `0023` à `0039` ne sont pas appliquées ;
- les tables `tenants` et `tenant_memberships` sont absentes ;
- les tables du grand livre en partie double et les identifiants d'appareils cryptographiques ne sont pas présentes dans le schéma actif ;
- les tables de suivi de sauvegarde interrogées sont vides.

Une requête SQL SELECT exécutée le 22 novembre confirme 23 migrations de `0000` à `0022`, l'absence de `tenants`, `tenant_memberships`, des tables comptables canoniques et des credentials cryptographiques. `sessions` ne comporte que `id`, `user_id`, `token_hash`, `expires_at`, `created_at` : les colonnes `active_tenant_id` et `revoked_at` ne sont pas présentes. Les trois tables `backup_runs`, `backup_objects` et `backup_verifications` contiennent chacune zéro ligne. La requête a confirmé `changed_db=false` et `rows_written=0`.

Les tests CI appliquent les migrations candidates sur une base SQLite isolée. Cela ne prouve pas leur application sur cette D1 partagée.

## Worker Preview — écart de version

Le Worker partagé `prochelia-api-preview` reste observé sur la version 35, avec `PROCHELIA_COMMIT_SHA=a952796ad23fbc6adbe75392c3a7a10bbe3a71e5`. Le build et le déploiement Preview de la branche PR créent une version isolée ; ils ne remplacent pas automatiquement le Worker partagé ciblé par le Service Binding Pages.

Contrôle Cloudflare du 22 novembre : version active `0d3db29a-1be4-4258-9786-9f8147007b9d`, créée le 18 novembre, 100 % du trafic, avec `PROCHELIA_COMMIT_SHA=a952796ad23fbc6adbe75392c3a7a10bbe3a71e5`. Le candidat API #317 est construit/déployé sur une Preview isolée et n'a pas remplacé ce Worker partagé. Le Worker partagé doit être aligné avec le candidat API et les migrations D1 avant toute recette Pages → Worker → D1. À défaut, les routes intervenant candidates et le modèle tenant ne sont pas disponibles sur le parcours live.

## Réconciliation des migrations avant application

La PR API #317 est empilée sur une branche de migration intermédiaire, pas directement sur `main`. Le fichier `0023_tenant_double_entry_accounting.sql` de la base de cette PR porte le blob SHA `3803c7da...`, tandis que le fichier du HEAD candidat porte `d9808daa...`, identique à la version correspondante de la PR #290. Cette différence doit être réconciliée explicitement dans une seule lignée canonique avant merge ou migration distante. Ne jamais appliquer deux variantes du même numéro de migration.

## Sécurité opérationnelle

- Le Worker Preview partagé n'a pas de Cron actif à la dernière lecture.
- Les invocation logs et traces ne sont pas activés dans la configuration relue le 22 novembre.
- La planification candidate dépend d'un secret de chiffrement absent de la configuration Worker observée précédemment. Ne pas activer de Cron avant validation des prérequis.
- Les paiements restent fail-closed : `paymentsConfigured() === false`. Aucun paiement ni payout réel n'est autorisé.

## Statut de release

**NO-GO** tant que la restauration réelle R2/D1, la réconciliation des migrations, l'alignement du Worker et les tests E2E multi-tenant ne sont pas démontrés.

Aucune migration distante, aucune écriture D1/R2, aucune modification de binding/secret, aucune activation Cron, aucun merge et aucune action Production ne sont autorisés par ce document.
