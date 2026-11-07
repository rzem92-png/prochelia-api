# PROCHÉLIA — R2 sauvegarde, restauration et gouvernance (préproduction)

> Statut : conception/runbook préproduction. Aucune sauvegarde automatisée ni restauration n'est déclarée active tant que les tests d'infrastructure et les preuves d'exécution ne sont pas attachés.

## 1. Principes non négociables
- Buckets privés; accès public et URL de développement R2 désactivés.
- Séparer les buckets et identités de préproduction et production.
- Secrets dans Cloudflare Worker Secrets / gestionnaire de secrets, jamais dans Git, logs, tickets ou conversation.
- Données de test synthétiques en préproduction; aucun export client/PII réel.
- Aucun changement D1, paiement, Worker production ou migration sans validation humaine explicite.
- Least privilege: identité d'écriture de sauvegarde distincte de l'identité de lecture/restauration; pas de droit de suppression globale.
- Chiffrement en transit (HTTPS) et au repos selon les mécanismes R2/Cloudflare applicables; vérifier les garanties contractuelles et la configuration Cloudflare avant toute revendication de conformité.

## 2. Modèle de sauvegarde recommandé
1. Inventorier les sources: D1, configuration Worker (sans secrets), objets R2, documents métier, logs/audit.
2. Définir pour chaque source RPO (perte maximale admissible) et RTO (durée de reprise) avec responsable métier.
3. Sauvegarder séparément:
   - D1: export/snapshot cohérent via mécanisme Cloudflare pris en charge, dans un environnement isolé.
   - R2: stratégie de réplication/copie contrôlée des objets et métadonnées nécessaires (version, checksum, date, source).
   - Configuration: IaC/configuration versionnée; secrets non exportés en clair.
4. Manifest de sauvegarde contenant uniquement métadonnées techniques: ID de lot, date UTC, source, nombre d'objets, taille totale, SHA-256 par objet/manifest, résultat et identifiant d'exécution.
5. Stocker le manifest et les copies dans un emplacement distinct du système source; définir protection contre suppression accidentelle/compromission.
6. Alerter en cas d'échec, sauvegarde manquante, checksum incohérent, volume inhabituel ou capacité insuffisante.

## 3. Procédure de restauration contrôlée
- Ouvrir un ticket incident/changement, désigner approbateur et opérateur.
- Vérifier l'intégrité du manifest et des checksums avant restauration.
- Restaurer d'abord en environnement isolé; jamais écraser directement la production.
- Vérifier comptages, tailles, checksums, schéma, relations métier et droits d'accès.
- Effectuer tests fonctionnels et de sécurité (auth, RBAC, accès interdit, idempotence).
- Obtenir l'approbation du propriétaire métier avant bascule.
- En cas d'échec: arrêter la bascule, préserver les logs, revenir à l'état précédent, documenter le résultat.
- Journaliser qui/quand/quoi/approbation, sans inclure de secrets ou de données personnelles superflues.

## 4. Test de restauration (preuve exigée)
- Dataset synthétique isolé et identifié.
- Créer snapshot/copie → calculer SHA-256 → restaurer dans une cible temporaire → recalculer SHA-256.
- Vérifier égalité des checksums et des métadonnées; tester lecture et suppression avec le rôle attendu.
- Nettoyer la cible temporaire; vérifier absence résiduelle.
- Conserver rapport de test, durée réelle, erreurs, opérateurs et validation.
- Critère de réussite: restauration vérifiée, contrôles de sécurité passés, durée inférieure au RTO approuvé.

## 5. Rétention / RGPD — décisions à approuver
La durée doit être fixée par finalité et obligations légales, pas arbitrairement. Établir un tableau de conservation pour:
- comptes/profils et pièces justificatives;
- missions, contrats et factures;
- paiements et éléments comptables;
- messages et litiges;
- logs sécurité/audit;
- backups et archives.

Pour chaque catégorie: finalité, base légale, durée active, durée d'archive, accès autorisé, suppression/anonymisation, exceptions légales (litige/comptabilité), propriétaire et preuve de purge.

- Les demandes d'effacement doivent déclencher une analyse des systèmes actifs, caches, exports, archives et backups; les backups peuvent suivre une échéance de rotation documentée, avec interdiction de réintroduire les données supprimées dans les systèmes actifs.
- Prévoir journal de purge non-identifiant, preuve de traitement et procédure de restauration tenant compte des suppressions.
- Validation par conseil juridique/DPO avant mise en œuvre: ce document n'est pas un avis juridique ni une politique de conservation finalisée.

## 6. Gates avant production
- [ ] RPO/RTO approuvés.
- [ ] Architecture et permissions de sauvegarde revues.
- [ ] Backup automatisé observé en succès sur plusieurs cycles.
- [ ] Restauration isolée réussie et mesurée.
- [ ] Checksums/manifest validés.
- [ ] Alertes et runbook incident testés.
- [ ] Politique de rétention validée par DPO/juridique.
- [ ] Aucune donnée réelle en préproduction.
- [ ] Approbation humaine écrite de mise en production.

## 7. État connu du R2 smoke Worker
- Health check live confirmé par utilisateur: `ok=true`, `r2_binding=true`, `token_configured=true`.
- Tests automatisés GitHub utilisent un bucket mocké; ils ne prouvent pas le PUT/GET/DELETE R2 réel.
- Le test réel PUT/GET/DELETE et la vérification d'ancien token restent à compléter.
