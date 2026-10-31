# PROCHÉLIA IA SUPRA — architecture cible V2

## Mission
Construire une intelligence centrale transversale qui aide la Gérante à piloter PROCHÉLIA de bout en bout, à anticiper les risques, à améliorer la qualité de service et à développer durablement l'activité en France puis à l'international.

L'IA SUPRA n'est pas un chatbot isolé. Elle orchestre des capacités spécialisées, un registre de domaines commun, des plans d'action traçables et des adaptateurs métier contrôlés.

## Domaines reliés
- Direction, stratégie, objectifs et performance.
- Finance, trésorerie, budgets, marges, commissions et coûts.
- Comptabilité, ledger, rapprochements, factures et impayés.
- Tarification, devis, promotions et plafonds applicables.
- Missions, réservations, planning, incidents et qualité.
- Matching des intervenants selon compétences, zone, distance, disponibilité et fiabilité.
- Clients, intervenants et entreprises B2B.
- Réclamations, conflits, médiation et satisfaction.
- Commercial, marketing, partenariats, parrainage et fidélisation.
- Sécurité, antifraude, continuité et contrôle des accès.
- RGPD, minimisation, droits, conservation, purge et audit.
- Juridique et conformité.
- International, langues, devises, moyens de paiement et règles locales.
- Innovation, expérimentation, automatisation et différenciation.
- Gestion des crises économiques, opérationnelles et de capacité.

## Cycle obligatoire de résolution
1. Détecter et classer le sujet.
2. Mesurer urgence, gravité et personnes potentiellement exposées.
3. Collecter uniquement les preuves auxquelles le rôle est autorisé à accéder.
4. Vérifier propriété, identité, statut, compétences, disponibilité et cohérence des données.
5. Identifier causes racines et dépendances inter-domaines.
6. Évaluer impacts juridiques, financiers, opérationnels, humains et réputationnels.
7. Générer au moins deux options réalistes.
8. Comparer coûts, marge, délai, qualité, risques et réversibilité.
9. Présenter une recommandation prioritaire, ses hypothèses et les conséquences d'une attente ou d'un refus.
10. Préparer les actions autorisées, demander les validations requises, exécuter via adaptateurs vérifiés.
11. Contrôler le résultat réel, réconcilier les données et journaliser les preuves.

## Politique d'autonomie
### Autonomie autorisée après tests dédiés
- Analyses et synthèses en lecture seule.
- Classement, détection de doublons et indicateurs.
- Préparation de scénarios, tâches internes et brouillons.
- Contrôles de cohérence, surveillance des sauvegardes et alertes.
- Relances de routine uniquement avec règles, consentements et canal validés.

### Validation explicite de la Gérante
- Engagement ou dépense financière significative.
- Remboursement, paiement, reversement ou changement de commission.
- Modification de prix ou activation d'une promotion.
- Réaffectation ou report d'une mission et changement contractuel.
- Suspension, résiliation, recrutement ou décision ayant un impact humain.
- Export, suppression ou modification irréversible de données.
- Engagement commercial, ouverture d'un pays, contrat ou dépense d'expansion.
- Décision juridique ou réglementaire.

### Escalade humaine urgente ou professionnelle
Danger immédiat, violence, urgence médicale, suspicion de maltraitance ou question juridique complexe : l'IA ne remplace pas les services d'urgence ni les professionnels habilités.

## Résilience économique
Surveiller la demande, le pouvoir d'achat, l'inflation, les coûts, la capacité des intervenants, la trésorerie, les fournisseurs de paiement, les évolutions réglementaires et les risques pays.

Chaque scénario doit préciser ses hypothèses, période, source, incertitude, impacts sur revenus/coûts/marge/trésorerie et mesures possibles. Une simulation n'est pas une prévision garantie et ne déclenche pas d'engagement.

## International
Aucun lancement de pays n'est automatique. Chaque marché doit avoir un dossier local : langue, devise, fiscalité, droit du travail et statut des prestataires, protection des consommateurs, données personnelles, assurances, moyens de paiement, fiscalité, partenaires, support et sécurité. Une revue locale qualifiée et l'approbation de la Gérante sont nécessaires avant ouverture.

## Architecture technique
- Un orchestrateur central, des domaines spécialisés et un contrat commun de décision.
- Séparation stricte entre recommandation, approbation, exécution et vérification.
- Adaptateurs explicites pour PSP, notifications, planning, matching, documents et comptabilité.
- Autorisations minimales, contrôle d'appartenance côté serveur, idempotence, journal d'audit et preuves.
- Aucun statut COMPLETED sans confirmation d'exécution réelle.
- Tests unitaires, contrats API, intégration D1 isolée, tests E2E, sécurité et restauration avant mise en production.

## État de la V2 intégrée dans cette branche
- Registre des domaines et planificateur transversal ajoutés.
- Gouvernance d'autonomie et escalade ajoutées.
- Intégration au moteur de recommandation des dossiers Copilote.
- Routes authentifiées de consultation des domaines et de génération de plans.
- File d'attente durcie : une action sans exécuteur vérifié ne peut plus être déclarée terminée.
- La simulation de résilience existante reste indicative.
- Les adaptateurs d'exécution réels et les tests E2E par domaine ne sont pas encore construits. La V2 ne doit donc pas être présentée comme une autonomie complète opérationnelle.

## Critères de sortie avant production
1. Tests verts sur la tête de branche actuelle.
2. Contrôle RBAC et propriété sur chaque route et chaque dossier.
3. Tests d'idempotence, anti-rejeu, concurrence et reprise après erreur.
4. Adaptateurs sandbox validés puis tests de bout en bout.
5. Rapprochement financier et webhooks PSP vérifiés.
6. Recette des trois espaces Client, Intervenant et Gérante.
7. Tests de sauvegarde/restauration, conservation et suppression RGPD.
8. Revue sécurité et conformité locale.
9. Approbation explicite de la Gérante.
10. Déploiement séparé avec plan de retour arrière.
