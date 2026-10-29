# PROCHÉLIA — runbook de sauvegarde, intégrité et restauration D1/R2 (préproduction)

**Statut : runbook à exécuter par une personne habilitée.** Le code et la configuration seuls ne prouvent ni la réussite d'une sauvegarde ni une restauration réussie. Ne jamais tester une restauration sur la production. Les secrets ne doivent jamais être commités ni collés dans les journaux.

## 1. Configuration de préproduction

Depuis un poste autorisé, à la racine du dépôt et après vérification du compte Cloudflare actif :

1. Vérifier le compte Cloudflare et le projet : `npx wrangler whoami`.
2. Créer le bucket R2 si nécessaire : `npx wrangler r2 bucket create prochelia-preview-backups`. Si le bucket existe déjà, ne pas le supprimer/recréer.
3. Définir un secret aléatoire fort, unique pour la préproduction, sans l'inscrire dans Git :
   `npx wrangler secret put BACKUP_ENCRYPTION_KEY`
   Saisir au prompt un secret généré par un gestionnaire de secrets. Ne pas réutiliser la clé de production.
4. Vérifier dans `wrangler.jsonc` le Cron `0 3 * * *` (03:00 UTC chaque jour) et le binding `BACKUP_BUCKET` vers `prochelia-preview-backups`.
5. Vérifier que le bucket est privé et que les droits Cloudflare sont limités au strict nécessaire. Activer une règle de cycle de vie R2 si la politique de rotation retenue le prévoit; la configuration du Worker ne crée pas, à elle seule, de règle de cycle de vie R2.
6. Déployer uniquement la préproduction après validation et autorisation explicite du responsable. Ce runbook ne déclenche aucun déploiement.

## 2. Lancer et contrôler une sauvegarde

Après déploiement autorisé de la préproduction, s'authentifier comme Gérante :

- Contrôle d'état : `GET /api/system/backups`
- Lancement manuel : `POST /api/system/backup/run`
- Vérifier `configured: true`, un résultat `COMPLETED`, un nombre de lignes/objets cohérent et les objets présents dans le bucket R2.
- Vérifier le Cron dans les déclencheurs/observabilité Cloudflare après le prochain 03:00 UTC. Un champ `automatic: true` dans une réponse ne constitue pas une preuve d'exécution.
- Alerter sur chaque statut `FAILED`, absence de sauvegarde quotidienne, incohérence du nombre d'objets ou erreur de clé.

Le code de sauvegarde exporte les tables applicatives en lots de 500 lignes, chiffre les données avec AES-GCM et conserve une empreinte SHA-256 des objets. Les tables de journal de sauvegarde ne doivent pas être exportées dans le même flux : cela éviterait une exportation récursive des objets de sauvegarde.

## 3. Restauration — exercice isolé obligatoire

**Ne pas restaurer directement sur la base utilisée par les utilisateurs.** La restauration destructive automatique n'est pas exposée par l'API.

1. Créer une base D1 temporaire isolée, sans données de production et sans trafic.
2. Geler les écritures de la préproduction pendant la capture de la sauvegarde testée.
3. Sélectionner un run `COMPLETED` et exporter sa liste d'objets, tables, tailles et empreintes depuis le journal d'administration.
4. Pour chaque objet R2, recalculer SHA-256 sur les octets récupérés et comparer exactement à l'empreinte enregistrée avant déchiffrement. En cas de différence, interrompre l'exercice.
5. Déchiffrer uniquement avec le secret de préproduction via un outil de restauration audité. Vérifier le format JSONL et le nombre de lignes. Ne jamais imprimer les lignes contenant des données personnelles.
6. Restaurer dans la base D1 temporaire après création du schéma compatible et vérification des dépendances/contraintes. Utiliser des transactions ou lots idempotents lorsque possible; arrêter au premier écart de schéma ou erreur d'intégrité.
7. Comparer les comptages de lignes, contraintes, relations essentielles et résultats d'un parcours de test non nominatif. Documenter le RPO (perte maximale acceptable) et le RTO (durée de reprise constatée).
8. Rejouer le registre de suppressions/rectifications intervenues après l'instant de sauvegarde avant de rouvrir la base. Si ce registre n'existe pas ou ne peut pas être rejoué, la restauration ne doit pas être remise en service pour les données personnelles.
9. Détruire la base temporaire et les fichiers déchiffrés avec une procédure contrôlée; conserver seulement le rapport de test, les métriques et les preuves minimales.

## 4. Limites techniques connues à résoudre avant une restauration complète

- Le format actuel est un export logique JSONL chiffré, pas une sauvegarde native D1 restaurable par une seule commande.
- Le schéma et les données de référence doivent être compatibles; l'ordre d'import doit respecter les clés étrangères et les contraintes.
- La procédure ci-dessus décrit la recette, mais un outil de déchiffrement/import contrôlé et un test réel sur D1 temporaire restent à réaliser. Ne pas annoncer une restauration validée avant le rapport de recette.
- La clé est indispensable à la restauration. Gérer sa sauvegarde de façon sécurisée, séparée du bucket et avec accès de secours contrôlé. La perte de clé rend les sauvegardes inutilisables.
- Le code de sauvegarde ne configure pas la politique d'expiration R2. La rétention technique et la suppression des objets doivent être définies et vérifiées dans les paramètres R2.

## 5. Suppression RGPD et sauvegardes

Une suppression d'une base active peut ne pas supprimer immédiatement toutes les copies de sauvegarde déjà écrites. Définir un mécanisme de tombstones/registre de suppression avec accès restreint et durée bornée, puis le rejouer après restauration. Les tombstones ne doivent conserver que l'identifiant technique minimal et l'opération nécessaire, pas le contenu supprimé. La politique et la durée de ce registre doivent elles-mêmes être justifiées. En attendant une procédure testée, ne pas prétendre qu'une suppression est immédiatement propagée à toutes les sauvegardes.

## 6. Conservation et archivage

La matrice `legal/10-matrice-conservation-archivage-purge-rgpd.md` est la source de travail pour les catégories et durées. Elle doit être approuvée par le responsable de traitement. Les archives intermédiaires doivent être distinctes, à accès limité et justifiées. Les données personnelles ne sont jamais conservées indéfiniment par défaut. Le bucket de sauvegarde n'est pas une archive métier permanente.

## 7. Preuves de recette à joindre au dossier de conformité

- capture/rapport de configuration Cron et binding R2, sans secret;
- résultat du run manuel `COMPLETED` et de la sauvegarde planifiée;
- liste d'objets et vérification SHA-256;
- rapport de restauration D1 temporaire avec comptages, intégrité, RPO/RTO;
- preuve de test de suppression/rectification suivie d'une restauration;
- règle de cycle de vie R2 et date de vérification;
- identité de l'approbateur, date, version de code et anomalies restantes.
