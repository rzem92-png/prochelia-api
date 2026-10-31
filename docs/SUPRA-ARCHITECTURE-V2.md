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
- Préparation de brouillons de relance et contrôles de routine en lecture seule.
- Envoi d’une relance uniquement après vérification du consentement, du canal autorisé, du modèle approuvé et de la règle métier ; l’envoi n’est pas dans la liste des tâches autonomes par défaut.

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

## Garde-fous de classification complémentaires
- Normalisation Unicode des libellés français accentués avant classification afin que « urgence médicale » et les autres formulations usuelles ne contournent pas les règles d’escalade.
- Routage explicite des situations urgentes vers la sécurité et des dossiers juridiques complexes vers le domaine juridique.
- Les notifications sortantes et relances restent des effets de bord : aucune autonomie d’envoi sans preuve de consentement, canal et règle approuvés.

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


## Matrice de couverture globale PROCHÉLIA — registre anti-oubli

Cette matrice est un registre de recette, pas une déclaration que les fonctions sont déjà opérationnelles. Chaque ligne doit être reliée à un endpoint, un propriétaire de données, une preuve d'exécution et un test automatisé avant d'être déclarée terminée.

### Expérience et espaces utilisateurs
- [ ] Client : découverte, inscription, demande rapide, devis détaillé, réservation, paiement, suivi, annulation, réclamation, facture, avis, fidélité et accessibilité.
- [ ] Intervenant : candidature, identité, vérification des documents, compétences, zones, disponibilités, acceptation/refus, planning, pointage QR, suivi de mission, frais et revenus.
- [ ] Gérante/Entreprise : pilotage, utilisateurs, rôles, missions, tarification, validation, finance, comptabilité, litiges, conformité, reporting, exports et audit.
- [ ] B2B : comptes sociétés, multi-sites, utilisateurs délégués, contrats-cadres, commandes, facturation et rapprochement.
- [ ] Responsive et accessibilité : iOS Safari/Chrome, Android, tablette, desktop, clavier, lecteurs d'écran, contrastes, langues et faible connectivité.

### Cycle de vie des prestations et des missions
- [ ] Catalogue de prestations versionné, description, durée, exclusions, zone, prérequis et niveau de risque.
- [ ] Disponibilités, matching explicable, score de confiance, distance, compétences, vérification et règles anti-discrimination.
- [ ] Cycle d'état unique et documenté : brouillon, devis, attente, confirmée, affectée, en cours, terminée, contestée, annulée, remboursée.
- [ ] QR de début/fin, horodatage serveur, géolocalisation proportionnée, preuve de présence, corrections manuelles tracées.
- [ ] Remplacement, retard, absence, annulation, urgence, continuité de service et notification des parties.
- [ ] Kilométrage, frais de déplacement, justificatifs, règles de calcul et non-rétroactivité.

### Tarification, revenus et comptabilité
- [ ] Un moteur serveur unique : tarif de référence actif, durée, quantité, zone, options, majorations, remises et frais.
- [ ] Promotions approuvées, dates de validité, cumul, éligibilité, budget et traçabilité.
- [ ] Plafonds réglementaires : règle applicable, frais inclus/exclus, source juridique, version et date d'effet, revue professionnelle.
- [ ] Calcul unique du brut client, net intervenant, commission fixe/variable, frais PSP, taxes, remboursements et marge.
- [ ] Snapshot du devis accepté, facture cohérente, avoir, annulation, litige, rapprochement PSP/ledger et idempotence.
- [ ] Aucune donnée financière estimée ne doit être présentée comme une transaction ou une marge réelle.

### Sécurité, confiance et conformité
- [ ] Authentification, récupération, MFA/OTP, sessions, révocation, limitation de débit, protection CSRF/origine et gestion des appareils.
- [ ] RBAC et contrôle de propriété côté serveur sur chaque endpoint, objet, fichier et action.
- [ ] Vérification identité/qualifications/assurance et échéance des documents, accès restreint et journalisé.
- [ ] Protection contre fraude, doublons, rejeu, concurrence, abus, usurpation et injections.
- [ ] RGPD : registre, base légale, consentement quand requis, minimisation, droits, durées, purge, anonymisation, sous-traitants et transferts.
- [ ] Contrats, CGU/CGV, médiation, assurance, responsabilité, statut indépendant et frontière entre intermédiation et employeur à faire valider par juriste compétent.
- [ ] Accessibilité, conservation des preuves et procédure d'incident de sécurité.

### Infrastructure, données et continuité
- [ ] Environnements séparés développement/préproduction/production et secrets distincts.
- [ ] Schéma D1 versionné, migrations répétables, sauvegarde avant migration, tests sur base isolée et rollback documenté.
- [ ] R2 chiffré, sauvegardes quotidiennes, vérification d'intégrité, restauration testée et preuves horodatées.
- [ ] Files et tâches asynchrones : idempotence, reprises, DLQ, limites, alertes et statut final fondé sur confirmation.
- [ ] Observabilité : logs structurés sans données sensibles, métriques, traces, alertes, SLO et coût par fonction.
- [ ] Dépendances, SBOM, mises à jour, scans vulnérabilités, rotation des clés et plan de réponse aux incidents.
- [ ] Tests de charge, panne PSP, panne DB, perte réseau, restauration et retour arrière.

### IA SUPRA et avantage concurrentiel
- [ ] Registre de compétences spécialisées et contrats d'entrée/sortie par domaine.
- [ ] Sources de données, fraîcheur, provenance, confiance, hypothèses et incertitude affichées.
- [ ] Détection de dérive, hallucination, conflit de règles, doublon, boucle et décision contradictoire.
- [ ] Simulation avant action, bac à sable, approbation signée, exécution idempotente et vérification après action.
- [ ] Mémoire métier contrôlée, journal de décision, explication, annulation/compensation et supervision.
- [ ] Veille marché et réglementaire sourcée, tests des changements et validation locale avant activation.
- [ ] Mesure de qualité : temps de résolution, taux d'erreur, satisfaction, marge nette réelle, rétention et coût opérationnel.

### Règle de passage
Une fonctionnalité ne passe à « validée » que si son contrat est documenté, ses permissions testées, ses cas nominaux et limites couverts, ses erreurs/reprises vérifiées, ses données de test isolées et sa preuve d'exécution conservée. Les intégrations PSP, SMS/email, GPS, stockage et signatures doivent être testées en sandbox avant toute activation réelle.
