# PROCHÉLIA LIFE — IA SUPRÊME : moteur permanent d'innovation et de croissance

**Statut :** spécification produit et opérationnelle — à implémenter et valider.  
**Branche cible :** prelaunch/v14.5.7-consolidation-audit  
**Principe :** découvrir souvent, expérimenter petit, mesurer réellement, déployer seulement après validation.

## 1. Mission

L'IA SUPRÊME est le copilote transversal de PROCHÉLIA LIFE. Elle aide la dirigeante à faire émerger de nouvelles sources de chiffre d'affaires, améliorer la marge, augmenter la récurrence et étendre progressivement le marché, sans dénaturer l'activité ni multiplier les fonctionnalités sans preuve de valeur.

Elle n'est ni une personne morale, ni une dirigeante juridique, ni un employeur. La responsabilité de l'entreprise et les décisions réservées restent humaines.

## 2. Boucle d'innovation continue

Exécuter cette boucle à cadence configurable (revue hebdomadaire par défaut ; surveillance événementielle seulement si une source autorisée existe) :

1. **Écouter** : demandes non satisfaites, abandons de devis, recherches sans résultat, motifs de contact au support, demandes récurrentes, retours clients et intervenants, tendances de marché légalement accessibles.
2. **Détecter** : regrouper les besoins par zone géographique suffisamment large, période, type de demande et fréquence. Ne pas exposer les données individuelles ni inférer des caractéristiques sensibles.
3. **Imaginer** : générer plusieurs concepts concrets : nouvelle prestation à qualifier, forfait, abonnement facultatif, partenariat, offre B2B, amélioration de parcours, service numérique ou nouvelle zone.
4. **Vérifier** : contrôler adéquation à l'objet de PROCHÉLIA, demande observée, capacité réelle, qualification des intervenants, assurance, réglementation, protection des données, risques de requalification, coûts et dépendances techniques.
5. **Chiffrer** : établir des scénarios prudent, central et ambitieux avec hypothèses explicites. Calculer la marge contributive après frais PSP, remboursements, support, acquisition, vérification, assurance et coûts variables pertinents. Distinguer chiffre d'affaires de la plateforme, sommes dues aux intervenants, taxes et volume d'affaires traité.
6. **Prioriser** : classer les concepts selon valeur client, potentiel de marge, preuve de demande, rapidité de test, coût, risque et réversibilité.
7. **Prototyper** : préparer une fiche, un parcours ou un test non public. Ne pas activer de nouvelle prestation, tarif, contrat ou publicité sans approbation requise.
8. **Expérimenter** : tester sur un périmètre limité, avec consentement, budget plafonné, durée, critères d'arrêt et groupe de comparaison si pertinent.
9. **Mesurer** : conversions, demandes servies, taux d'annulation, réachat, satisfaction, délai de mise en relation, marge contributive et incidents.
10. **Décider** : recommander d'arrêter, corriger, prolonger ou étendre. Toute extension sensible passe par les validations requises.
11. **Capitaliser** : documenter les résultats, les hypothèses invalidées et les apprentissages pour éviter de reproposer les mêmes idées sans élément nouveau.

## 3. Registre des opportunités

Chaque concept doit créer une fiche structurée comprenant :

- identifiant unique, date, version et agent initiateur ;
- problème client observé et preuve associée ;
- segment et zone visés, sans profilage sensible ;
- proposition de valeur et parcours client ;
- prestations concernées et statut de qualification réglementaire ;
- mode d'intervention envisagé et responsabilités de chaque partie ;
- disponibilité et compétences réellement vérifiées ;
- modèle de revenus et hypothèses de prix ;
- coûts variables, marge contributive et seuil de rentabilité ;
- estimation de demande avec niveau de confiance ;
- risques juridiques, opérationnels, réputationnels, cyber et RGPD ;
- dépendances produit, partenaires et prestataires ;
- test minimal, budget maximum, durée et critères de succès/arrêt ;
- niveau d'approbation, décision, responsable humain et journal d'audit.

États autorisés : idea, evidence_needed, screening, legal_review, business_case, prototype, pilot_approved, pilot_running, scale_candidate, approved_to_scale, paused, rejected, retired.

## 4. Priorisation et règles anti-dispersion

Évaluer chaque concept sur 100 points, avec pondérations initiales configurables :

- preuve de demande et fréquence : 25 ;
- marge contributive potentielle : 20 ;
- cohérence avec la mission et la marque : 15 ;
- faisabilité opérationnelle et capacité disponible : 15 ;
- vitesse et coût du test : 10 ;
- potentiel de récurrence ou de recommandation : 10 ;
- réversibilité : 5.

Le score ne neutralise jamais un risque bloquant. Un concept juridiquement non qualifié, non assurable, sans capacité vérifiée ou présentant un risque disproportionné est bloqué même avec un score élevé.

Règle anti-dispersion : limiter le nombre de pilotes simultanés. Par défaut, un pilote principal et un seul test secondaire ; réviser cette limite selon la capacité réelle. Prioriser l'amélioration d'une offre qui vend déjà avant d'ajouter une nouvelle ligne d'activité.

## 5. Portefeuille de croissance à explorer

L'IA peut proposer, sans présumer qu'ils sont déjà autorisés ou rentables :

1. **Continuité Famille** : formule facultative de coordination, suivi des demandes, partage d'informations autorisées et rappels.
2. **PROCHÉLIA Pro / Business** : espace de demandes et de suivi pour organisations et partenaires, avec contrats et niveaux de service validés.
3. **Cercle de recommandation** : parrainage et avantages transparents, sans rémunération ou pratique illicite.
4. **Passeport de compétences** : compétences déclarées, justificatifs vérifiés, expériences et préférences des intervenants ; accès contrôlé et rectification possible.
5. **Radar de besoins locaux** : signaux agrégés de demandes non satisfaites pour aider à faire émerger une offre locale, sans révéler l'identité d'un client.
6. **Services numériques complémentaires** : outils de coordination, documents, rappels et tableaux de bord, sans confusion avec un acte médical, social réglementé ou une prestation non autorisée.
7. **Partenariats de distribution** : associations, acteurs locaux, assureurs, mutuelles, résidences et entreprises, après diligence et validation des responsabilités.
8. **Licence / marque blanche** : uniquement après preuve du modèle, stabilité opérationnelle et audit sécurité/conformité.

Toute prestation liée à des publics vulnérables ou à des activités réglementées exige une qualification préalable précise, une analyse du mode d'intervention, des autorisations éventuelles et de l'assurance. Ne jamais publier une offre sur la seule décision d'un agent IA.

## 6. Architecture des agents

Agents logiciels spécialisés, sous orchestration centrale :

- **Market Radar** : observe les signaux autorisés et les besoins non couverts.
- **Customer Insight** : analyse les retours et frictions de parcours.
- **Offer Designer** : conçoit des offres et parcours.
- **Unit Economics** : calcule revenus, coûts, marge et scénarios.
- **Compliance Sentinel** : déclenche les contrôles juridiques, réglementaires, assurance et RGPD ; il peut bloquer et escalader, mais ne remplace pas un professionnel.
- **Capacity & Quality** : vérifie la capacité réelle, les compétences, les annulations et les indicateurs qualité.
- **Growth Lab** : prépare des tests marketing et de conversion dans les limites autorisées.
- **Partnership Scout** : qualifie des pistes de partenariats sans engager l'entreprise.
- **Expansion Analyst** : compare les territoires et pays selon demande, droit local, fiscalité, assurance, paiement, langue et coûts.
- **Executive Synthesizer** : produit une synthèse priorisée et soumet les décisions à la dirigeante.

Chaque agent possède un périmètre, des sources autorisées, des permissions minimales, un budget, un journal et un mécanisme d'arrêt.

## 7. Niveaux d'autonomie

- **A0 — Observer** : lire les données autorisées, calculer et signaler.
- **A1 — Préparer** : rédiger une proposition, un devis interne, un prototype ou un plan de test.
- **A2 — Exécuter sous règles préapprouvées** : opérations limitées, réversibles, plafonnées et journalisées, par exemple classer des retours ou envoyer un rappel transactionnel déjà validé.
- **A3 — Approbation humaine obligatoire** : publication d'une nouvelle offre, changement de tarif ou commission, contrat, campagne publique, remboursement exceptionnel, paiement/payout, activation d'un territoire, accès sensible, engagement partenaire, dépense ou modification de production.
- **A4 — Validation professionnelle** : avocat, expert-comptable, DPO, assureur, PSP ou conseil local selon le sujet.

Aucun agent ne peut modifier ses propres permissions, augmenter son budget, désactiver les contrôles, accéder aux secrets de production ou s'auto-approuver.

## 8. Garde-fous et données

- Minimisation des données, finalités documentées, durées de conservation et droits des personnes.
- Pas d'inférence ou de ciblage fondé sur des données sensibles.
- Agrégation géographique et temporelle suffisante pour réduire le risque de réidentification.
- Pas de classement opaque des travailleurs indépendants déterminant leur visibilité sans analyse juridique et IA Act préalable.
- Pas de pénalité pour refus d'une mission ni de mécanisme qui impose de fait horaires, tarifs ou exclusivité incompatibles avec l'autonomie annoncée.
- Traçabilité des décisions, explications compréhensibles, correction humaine et procédure de contestation.
- Séparation des fonds, comptabilité et rapprochement PSP selon le modèle contractuel retenu.
- Kill switch global et par agent ; idempotence des actions ; plafonds de dépenses ; alertes d'anomalie.
- Données de test synthétiques ou anonymisées autant que possible.

## 9. Tableau de bord de la dirigeante

Revue hebdomadaire courte :

- chiffre d'affaires réellement encaissé par la plateforme ;
- volume d'affaires traité, présenté séparément ;
- marge contributive par prestation, canal et territoire ;
- demandes reçues, devis acceptés, missions réalisées ;
- demandes perdues et raisons ;
- délai moyen de mise en relation ;
- taux de réachat et récurrence ;
- coût d'acquisition et délai de récupération ;
- disponibilité vérifiée et taux d'annulation ;
- satisfaction, réclamations, remboursements et incidents ;
- opportunités détectées, testées, gagnantes et abandonnées ;
- dépenses IA et coût par opportunité qualifiée.

Aucune prévision ne doit être présentée comme du chiffre d'affaires acquis. Afficher les hypothèses, la période, la taille d'échantillon et le niveau de confiance.

## 10. Plan d'implémentation recommandé

### Phase 1 — Fondation sûre
- Registre d'opportunités et états de workflow.
- Agent orchestrateur, registre d'agents et permissions.
- Journal d'audit, idempotence, budgets, kill switch et approbations.
- Jeu de données de test et tests d'accès/permissions.

### Phase 2 — Intelligence économique
- Événements de parcours client et motifs de demandes non satisfaites.
- Agrégation respectueuse de la vie privée.
- Calculateur unifié de marge contributive.
- Scoring explicable et tableau de bord.

### Phase 3 — Expérimentation commerciale
- Fiches de concepts et business cases.
- Génération de prototypes non publics.
- Gestion des pilotes, budgets et critères d'arrêt.
- Mesure des résultats et journal des décisions.

### Phase 4 — Croissance contrôlée
- Parrainage et fidélisation validés.
- Abonnement Famille uniquement après preuve d'usage et de rétention.
- Espace B2B et partenariats après validation des contrats et responsabilités.
- Expansion géographique après étude locale.

### Phase 5 — International
- Dossier pays : droit des services, statut des prestataires, protection des consommateurs, fiscalité, données, paiements, assurance, langue et support.
- Activation pays par pays, jamais par simple traduction de l'interface.

## 11. Critères d'acceptation avant toute mise en production

- Aucun concept ne peut passer à pilot_approved sans approbation humaine et contrôles bloquants satisfaits.
- Aucun tarif ou paiement ne peut être modifié par un agent non autorisé.
- Toute action est traçable avec acteur, horodatage, motif, entrée et résultat.
- Les reprises d'événements ne créent ni double mission ni double paiement.
- Les plafonds de dépenses et le kill switch sont testés.
- Les données personnelles ne sont pas présentes dans les rapports agrégés non nécessaires.
- Les scénarios de marge distinguent les fonds de la plateforme et ceux des intervenants.
- Les tests couvrent les refus, erreurs, timeouts, doublons, annulations, remboursements et escalades.
- Les parcours clients, intervenants et gestion restent à tester séparément de l'API.
- Aucun déploiement ni migration réelle n'est autorisé par cette spécification seule.

## 12. Décision produit

La mesure du succès n'est pas le nombre d'idées générées. C'est le nombre d'expériences validées qui créent une valeur client démontrée et une marge contributive positive, sans dégrader la qualité, la conformité ni la confiance.

**Formule directrice :** innover en continu, prouver avant d'étendre, automatiser ce qui est sûr, faire valider ce qui engage l'entreprise.
