# PROCHÉLIA — plan d'exécution contrôlé des 10 chantiers

Date de référence : 2026-11-18  
Périmètre : dépôts GitHub et ressources Cloudflare Preview uniquement.  
Statut global : **NO-GO Production**.

Ce document est un plan de travail et une grille de preuves. Il ne certifie ni conformité juridique/comptable, ni recette réelle, ni disponibilité d'une automatisation autonome.

## Invariants non négociables

- Ne jamais modifier les ressources, secrets, données, migrations, paramètres de paiement ou déploiements Production.
- Ne jamais fusionner automatiquement une PR.
- Ne jamais exécuter une migration distante sans revue explicite, sauvegarde vérifiée, plan de restauration testé et approbation humaine.
- Ne jamais activer les mouvements financiers réels sans adaptateur PSP opérationnel, recette Sandbox E2E, avis juridique et autorisation humaine.
- Ne jamais traiter un succès CI comme preuve d'une recette live.
- Toute action sensible doit être RBAC, tenant-scoped, journalisée, idempotente si applicable et soumise à approbation.
- Distinguer les contrôles ponctuels, les workflows réellement exécutés et les recommandations non exécutées.

## 1. Direction et stratégie

Livrables : dictionnaire KPI versionné, marge par mission calculée depuis données sourcées, budget et prévisions séparant réalisé/estimé, registre des risques, décisions et plan d'action.
Gates : aucune donnée comptable synthétique présentée comme réelle ; chaque KPI indique source, période, fraîcheur, formule et limites.
Tests : calculs déterministes sur fixtures synthétiques, tests de droits et traçabilité de chaque changement de formule.

## 2. Comptabilité de l'entreprise

Livrables : modèle en partie double, journaux, plan de comptes France (PCG), pièces justificatives, factures clients/fournisseurs, dépenses, TVA, rapprochements, grand livre, clôtures, exports et piste d'audit. Concevoir séparément une matrice Algérie fondée sur le SCF et les règles locales.
Gates : écritures équilibrées débit/crédit, montants entiers en unités monétaires mineures, devise explicite, périodes verrouillées, corrections par contrepassation, références documentaires et tenant obligatoires.
Validation : expert-comptable compétent avant usage comptable réel ou déclaration fiscale.

## 3. Finance de la plateforme

Livrables : interface PSP isolée, commissions, remboursements, payouts, webhooks signés, idempotence, rapprochement et registre de règlement.
Gates : mode Sandbox uniquement ; aucun secret dans le code ; signature et fenêtre temporelle vérifiées ; unicité provider/event ; état financier cohérent ; mouvements réels désactivés.
Validation : recette Sandbox E2E, avis juridique sur le rôle de la plateforme et autorisation humaine explicite.

## 4. Juridique et conformité

Livrables : registre des traitements, cartographie des rôles, contrats, CGU/CGV, politique de conservation, sous-traitants, transferts France/Algérie, analyse DSA selon les fonctionnalités, assurances et propriété intellectuelle.
Gates : chaque obligation est reliée à une source officielle datée et à un responsable ; les recommandations IA sont non engageantes.
Validation : avocat France/Algérie et DPO avant toute conclusion ou engagement réglementaire.

## 5. Technique et cybersécurité

Livrables : architecture documentée, inventaire des secrets, RBAC/IAM, sessions révocables, chiffrement, séparation tenant, sauvegarde/restauration, observabilité, SLO, charge, réponse incident, dépendances et chaîne CI/CD.
Gates : tests négatifs inter-tenant, contrôle des permissions, rotation/révocation, anti-rejeu, fail-closed et provenance des artefacts.
R2 : prouver juridiction EU, règle de rétention approuvée, export chiffré, attestation HMAC distincte, checksum, téléchargement et restauration isolée. Aucun export tant que la durée n'est pas approuvée.

## 6. Opérations

Livrables : parcours client, entreprise et intervenant ; vérifications ; cycle mission ; réclamations/litiges ; qualité ; support ; fraude ; SLA ; sécurité des personnes.
Gates : états de mission explicites, transitions autorisées, horodatage, responsable, preuve, mécanisme de contestation et journal d'événements.
Tests : parcours E2E synthétiques de bout en bout et tests d'accès inter-rôles/inter-entreprises.

## 7. Gouvernance NEXUS SUPRA

Livrables : registre des domaines, tableaux de bord, recommandations, détection d'anomalies, approbations, journal d'activité et arrêt d'urgence.
Gates : moindre privilège, séparation des tâches, approbateurs distincts, approbation liée au tenant/ressource/payload/montant/devise, expiration et consommation à usage unique.
Les tâches réglementées, juridiques, fiscales, bancaires, irréversibles ou à risque élevé restent bloquées jusqu'à validation humaine. Aucune prétention d'activité autonome entre exécutions planifiées.

## 8. Recette et fiabilité de livraison

- Exécuter la recette HTTP/E2E sur les commits exacts Pages et Worker.
- Vérifier fixtures synthétiques, nettoyage, journaux et preuves d'absence d'écriture hors périmètre.
- Résoudre les incidents runner/BlobNotFound sans désactiver ni affaiblir le contrôle.
- Protéger les branches principales par checks obligatoires, revues et interdiction de force-push/suppression.
- Documenter chaque run avec SHA, workflow, job, logs et conclusion.

## 9. Préparation France puis Algérie

France : vérifier les règles applicables aux services, consommation, travail/prestation, fiscalité, assurances, RGPD et obligations de plateforme.
Algérie : établir une matrice distincte SCF, fiscalité, données personnelles, contrats, paiements, change, assurances et droit du travail.
Les flux transfrontaliers et transferts de données doivent être cartographiés avant ouverture du marché algérien. Ne pas extrapoler une règle française à l'Algérie.

## 10. Décision de mise en service

Le statut ne peut passer à GO que si toutes les preuves suivantes sont disponibles et relues :
1. recette E2E live sur versions exactes ;
2. sauvegarde et restauration R2/D1 vérifiées ;
3. isolation multi-tenant testée sur tous les handlers sensibles ;
4. device trust cryptographique enrôlable, révocable et anti-rejeu ;
5. PSP Sandbox E2E complet et avis juridique ;
6. comptabilité revue par expert-comptable ;
7. conformité revue par avocat/DPO ;
8. tests de charge, reprise et réponse incident ;
9. protections GitHub et chaîne de livraison approuvées ;
10. décision finale humaine documentée.

## État de référence observé le 18 novembre 2026

- Worker Preview observé sur le commit applicatif `a952796ad23fbc6adbe75392c3a7a10bbe3a71e5`, pas sur le HEAD historique `cd166f1ad7070fadf3b99a7385a7d5857d4dbcdd`.
- Pages Preview observé sur le commit `2c4ff92258e3f51dca1b2d3e96d8f4591a496b5b`.
- D1 Preview inspectée en lecture SQL : 95 tables et 23 migrations selon le catalogue SQL ; schéma tenant/comptabilité encore incomplet.
- Backup R2 arrêté avant export car `R2_EXPECTED_RETENTION_SECONDS` est vide ; les règles Object Lock exactes n'ont pas été vérifiées par ce run.
- Le runner frontend `structural-smoke` échoue avant les étapes avec `steps=null` ; téléchargement des logs renvoie `BlobNotFound`.
- Les mouvements financiers réels restent désactivés.
- La protection des branches `main` a été observée désactivée dans les contrôles précédents ; relecture obligatoire avant toute décision.

## Journal d'exécution

Ajouter pour chaque passage : date/heure UTC, ressources et SHA observés, actions en Preview, tests et liens de logs, fichiers/PR touchés, régressions, limites, approbations humaines requises. Ne jamais inscrire un succès sans preuve vérifiable.
