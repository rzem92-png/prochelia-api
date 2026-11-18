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

## Mise à jour de contrôle — 18 novembre 2026, session de reprise

### PR et intégration
- PR API ouvertes : #234, #287, #288, #289, #290 et #291 ; PR frontend #32 ouverte. Leur état ouvert n'est pas une approbation de fusion.
- Les contrôles CI précédemment observés sur les SHA courants de #287, #288, #289 et #290 ont réussi pour les suites indiquées dans le journal de session, mais ils ne remplacent pas les preuves runtime.
- La relance frontend #32 (run 44300168100) a échoué avant exécution des étapes (steps=null, 404 BlobNotFound). Incident d'infrastructure de logs à diagnostiquer, sans affaiblir les tests.

### Sauvegarde et migrations Preview
- Relecture du workflow .github/workflows/apply-preview-d1-migrations.yml sur la branche de #290 : le workflow vérifie l'identité et la juridiction EU de D1/R2, exporte, chiffre, téléverse et compare l'objet téléchargé.
- Limite critique : ce parcours ne démontre pas une restauration dans une D1 isolée de validation avant migration ; il ne vérifie pas non plus explicitement la rétention approuvée et l'Object Lock du préfixe objet exact, ni la consommation de l'attestation HMAC de #288.
- En conséquence, le parcours actuel ne satisfait pas encore le gate de restauration/immutabilité défini dans ce document. Ne pas déclencher APPLY_PREVIEW_ONLY et ne pas appliquer de migration distante tant que ces contrôles ne sont pas intégrés, testés et approuvés.
- Le run backup #44302717496 s'était arrêté avant l'export : R2_EXPECTED_RETENTION_SECONDS vide ; aucun backup restaurable n'est prouvé par ce run.

### Schéma, finance et sécurité
- L'inspection SQL antérieure de D1 Preview relevait 95 tables et 23 migrations, mais pas encore de tables tenant/membership attendues ni de contexte tenant actif dans les sessions ; le registre d'audit Supra ne démontrait pas encore une chaîne d'intégrité complète.
- Le schéma comptable existant n'est pas une preuve de comptabilité en partie double opérationnelle. La PR #290 ajoute des migrations de schéma ; elles ne sont pas appliquées à distance.
- La PR #289 apporte un vérificateur natif de signature Stripe, mais paymentsConfigured(env) reste faux : aucun adaptateur PSP opérationnel ni E2E Sandbox complet n'est démontré ; les paiements et reversements réels restent bloqués.
- Le modèle de device trust ne démontre pas encore un enrôlement cryptographique complet (clé publique, challenge/attestation, révocation et anti-rejeu).

### Configuration Pages / Worker
- Pages Preview a été observé avec le binding de service PROCHELIA_API vers prochelia-api-preview et le D1 Preview EU attendu.
- La variable Preview PROCHELIA_TRUSTED_API_ORIGIN pointe vers un ancien déploiement Pages staging ; vérifier sa nécessité et sa cohérence avant de promouvoir le frontend.
- La configuration Pages Production contient SUPRA_API_ORIGIN vers un Worker de branche/feature. Le proxy de la PR frontend #32 s'appuie sur PROCHELIA_API_ORIGIN/binding de service ; l'usage réel de SUPRA_API_ORIGIN n'est pas établi. Ne pas modifier à l'aveugle : inventorier les références runtime puis faire un test de routage sur Preview.
- Aucun changement de configuration Cloudflare n'a été effectué pendant cette reprise.

### Décision
**NO-GO maintenu.** Aucun merge, aucune migration distante, aucun changement de Production et aucun paiement réel. Les validations comptables, juridiques, fiscales, DPO et bancaires restent à effectuer par les professionnels et responsables habilités.
## Rectification après relecture des workflows PR #288 et #290 — 18 novembre 2026

- PR #288, branche `fix/r2-preview-backup-signed-attestation-2026-11-18` : le workflow de backup contient maintenant le contrôle de la règle R2 EU `/lock` sur le préfixe exact `preview-d1/${EXPECTED_DB_NAME}/`, compare la durée à la variable `R2_EXPECTED_RETENTION_SECONDS`, et vérifie le manifeste HMAC, les empreintes chiffrée/déchiffrée et le round-trip SQLite local. Le dernier run connu #44302717496 s'était arrêté avant export parce que la variable de rétention était vide. Il ne prouve donc ni backup runtime ni restauration distante isolée.
- Le workflow distinct `restore-preview-r2-backup-isolated-test.yml` de #288 cible une D1 de validation séparée et vérifie l'attestation avant restauration. Son existence dans le dépôt n'est pas une preuve d'exécution réussie ; il doit être exécuté explicitement après configuration des secrets et validation humaine.
- PR #290, branche `feat/accounting-double-entry-ledger-2026-11-18` : le workflow de migration compare les 26 migrations et le schéma distant à la baseline 23 et à la cible 26. Il ne consomme toutefois pas le manifeste HMAC de #288, ne vérifie pas lui-même l'Object Lock/la rétention R2, et n'exécute pas une restauration distante isolée avant l'écriture Preview.
- Les PR #288 et #290 ont reçu des commentaires détaillant ces constats et les gates manquants (commentaires #6980160278 et #6980161651).
- Gate bloquant : ne pas déclencher `APPLY_PREVIEW_ONLY` tant que le workflow de migration ne lie pas explicitement une attestation HMAC vérifiée, une règle de rétention approuvée sur le préfixe exact et une restauration isolée réussie au backup utilisé.

Décision inchangée : aucun merge, aucune migration distante, aucun changement Production et aucun paiement réel.