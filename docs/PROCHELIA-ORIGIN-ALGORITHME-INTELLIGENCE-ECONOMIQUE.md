# PROCHÉLIA ORIGIN — Algorithme d'intelligence économique adaptative

Date : 30 octobre 2026  
Statut : spécification produit et technique — conception, non implémentée en production.

## 1. Vision

PROCHÉLIA ORIGIN n'est pas un moteur conçu pour maximiser le temps passé devant un écran. Il doit réduire la distance entre un besoin réel, une personne ou une entreprise capable d'y répondre, une proposition compréhensible et une transaction réussie.

Promesse : **la bonne opportunité, pour la bonne personne, au bon moment, avec une explication claire et un résultat utile.**

L'algorithme doit servir simultanément :
- le client : pertinence, disponibilité, qualité, prix total, sécurité et choix ;
- le professionnel ou créateur : accès équitable à la demande, rémunération compréhensible et maîtrise de son activité ;
- PROCHÉLIA : transactions viables, réachat, confiance et marge contributive positive ;
- le territoire : visibilité des compétences et de l'offre locale, sans enfermement géographique artificiel.

Il n'est pas possible de garantir qu'un algorithme surpassera TikTok ou tout acteur mondial. La différenciation doit être prouvée par des résultats mesurés, dans les usages propres à PROCHÉLIA.

## 2. Les neuf moteurs coordonnés

### A. Moteur de compréhension du besoin
Transforme une demande en intention structurée : catégorie, lieu ou zone, date, délai, budget déclaré, contraintes, niveau d'urgence et résultat attendu. L'utilisateur peut corriger le résumé avant toute mise en relation. Ne pas déduire une caractéristique sensible.

### B. Moteur de capacité réelle
Évalue les compétences déclarées et vérifiées, disponibilités, distance, capacité, statut documentaire, périmètre d'activité autorisé, historique de fiabilité et préférences de mission. Une compétence non vérifiée ne doit jamais être présentée comme certifiée.

### C. Moteur de mise en correspondance
Élimine d'abord les incompatibilités bloquantes (zone, disponibilité, compétence indispensable, statut, consentement, sécurité). Classe ensuite les candidats éligibles selon la pertinence et l'équilibre des critères. Ne jamais compenser une condition de sécurité manquante par un bon score commercial.

### D. Moteur d'opportunités émergentes
Détecte les besoins récurrents non satisfaits, les délais trop longs, les zones insuffisamment couvertes et les demandes abandonnées. Il propose des hypothèses aux équipes et professionnels ; il ne crée pas automatiquement une offre, un prix ou une obligation.

### E. Moteur de recommandation réciproque
Le client découvre des offres utiles ; les professionnels reçoivent des opportunités compatibles avec leurs capacités et disponibilités. La recommandation doit être explicable et paramétrable. Aucun paiement ne peut acheter une meilleure place organique sans étiquette publicitaire claire.

### F. Moteur de confiance
Expose des informations vérifiables : contrôles réellement réalisés, avis contextualisés, taux de réponse calculé sur une période définie, annulations, réclamations et preuves de réalisation lorsque le cadre le permet. Ne pas fabriquer de note, de badge ou de certification.

### G. Moteur de conversion et de fidélité
Simplifie devis, réservation, commande, suivi, paiement, service après-vente et nouvelle commande. Optimise la réussite et la satisfaction, pas les clics ni le temps d'écran. Le refus d'une recommandation ne doit pas pénaliser l'utilisateur.

### H. Moteur de marge responsable
Calcule la contribution réelle après rémunération du professionnel, frais PSP, taxes applicables, remboursements, fraude, support et coûts variables. Une opportunité à marge négative ne doit pas être poussée uniquement pour augmenter le volume.

### I. Copilote de pilotage
Explique les signaux, propose des tests et prépare des actions. Par défaut, il recommande et rédige ; il ne peut ni modifier silencieusement les prix, ni publier une campagne, ni engager une dépense, ni suspendre une personne, ni déplacer des fonds sans autorisation adaptée.

## 3. Pipeline de décision

1. Recueillir une demande avec information et consentement appropriés.
2. Normaliser les éléments utiles et demander confirmation si l'intention est ambiguë.
3. Appliquer les règles d'éligibilité et de sécurité en mode fail-closed.
4. Constituer un ensemble de candidats réellement disponibles.
5. Calculer un score explicable sur des critères non sensibles.
6. Diversifier les résultats afin d'éviter qu'un petit groupe monopolise systématiquement la visibilité.
7. Afficher les raisons principales de la recommandation et le prix total connu.
8. Laisser le client comparer, choisir, refuser ou demander d'autres résultats.
9. Suivre le résultat réel : commande, annulation, satisfaction, litige, réachat.
10. Évaluer les performances par cohortes et déployer les changements progressivement, avec possibilité de retour arrière.

## 4. Score de classement — première version interprétable

Le score est calculé uniquement pour les candidats déjà éligibles. Première hypothèse de pondération à tester, pas une vérité définitive :

- adéquation à la demande : 30 % ;
- disponibilité et délai réaliste : 20 % ;
- qualité vérifiée et satisfaction contextualisée : 15 % ;
- proximité ou logistique pertinente : 10 % ;
- transparence et adéquation du prix total au budget déclaré : 10 % ;
- fiabilité opérationnelle récente : 10 % ;
- continuité ou préférence explicitement exprimée : 5 %.

Score = somme des critères normalisés × leurs poids. Les données manquantes sont signalées et ne sont pas automatiquement assimilées à une mauvaise qualité. La confiance dans le score est affichée séparément de sa valeur. Les critères, périodes et pondérations doivent être versionnés et audités.

La commission, le montant dépensé en publicité ou le statut de partenaire commercial ne doivent pas augmenter le classement organique. Les annonces payantes éventuelles doivent être séparées, identifiées et désactivables.

## 5. Innovation différenciante : le graphe d'opportunités

Construire progressivement un graphe reliant :
- besoins et intentions ;
- compétences, métiers et certifications ;
- professionnels, créateurs et commerces ;
- prestations, produits, ateliers, événements et contenus ;
- lieux, créneaux et capacités ;
- devis, commandes, résultats et récurrence.

Exemple : une demande répétée de repas adaptés à domicile peut faire émerger une hypothèse de partenariat entre un cuisinier vérifié, un producteur local et un service de livraison autorisé. Le système propose le test, chiffre les coûts et demande validation. Il ne présume pas que l'opportunité est rentable ou juridiquement permise.

Chaque opportunité comporte : preuve observée, taille d'échantillon, confiance, bénéficiaires potentiels, risques, coût estimé, marge estimée, test minimal, responsable, date d'expiration et décision humaine.

## 6. Apprentissage sans manipulation

Signaux utiles : demande satisfaite, délai tenu, devis accepté, commande terminée, réclamation résolue, satisfaction volontaire, réachat et marge contributive.

Signaux à ne pas optimiser comme objectifs principaux : durée d'écran, défilement compulsif, notifications répétitives, achats impulsifs ou nombre brut de clics.

Éviter les boucles de rétroaction : les offres déjà visibles ne doivent pas recevoir automatiquement toute la demande future. Utiliser une exploration limitée et contrôlée pour donner une chance aux nouveaux professionnels éligibles, sans exposer le client à des profils non qualifiés.

Distinguer corrélation et causalité. Tester les changements avec groupes témoins lorsque possible, taille d'échantillon suffisante et métriques de garde-fou. Ne pas personnaliser à partir de données sensibles ou de proxys sensibles.

## 7. Confidentialité, équité et sécurité

- Minimisation des données ; finalité et durée de conservation documentées.
- Consentement et préférences de personnalisation contrôlables.
- Pas d'inférence de santé, religion, origine, orientation, opinions politiques ou autre donnée sensible pour le classement.
- Pas d'utilisation de messages privés, carnets d'adresses ou données de plateformes tierces sans base légale, consentement et accès autorisé.
- Explication compréhensible des principales raisons de recommandation.
- Voie de recours pour les professionnels et les clients.
- Contrôle des biais par zone, catégorie, ancienneté et taille d'échantillon, sans utiliser de caractéristiques sensibles pour discriminer.
- Journalisation des versions, décisions automatisées, interventions humaines et incidents.
- Limites de fréquence et désactivation des recommandations personnalisées.
- Les décisions à fort impact (suspension, refus d'accès, prix contractuels, sanctions) nécessitent une revue humaine et une procédure de contestation.

## 8. LIVE, talents et commerce local

Le LIVE n'est pas un flux vidéo à maximiser. Il devient une vitrine transactionnelle optionnelle :
- démonstration d'un savoir-faire ;
- réservation d'un créneau ou d'un atelier ;
- demande de devis personnalisé ;
- commande d'un produit disponible ;
- événement ou prestation ;
- soutien volontaire ou abonnement, si le cadre PSP et juridique le permet.

Le moteur recommande un LIVE lorsqu'il répond à une intention, une disponibilité et une capacité de traitement. Il ne doit pas promettre des ventes ni pousser des achats par fausse urgence. Les règles de droit d'auteur, musique, image, publicité, cadeaux virtuels, fiscalité et protection des mineurs doivent être vérifiées selon les pays.

## 9. Indicateurs de réussite

Indicateur principal : **taux de besoins satisfaits de manière sûre et rentable**.

Mesures :
- taux de demandes ayant reçu au moins une proposition éligible ;
- taux de devis acceptés et de commandes terminées ;
- délai médian jusqu'à une proposition pertinente ;
- satisfaction après réalisation et taux de réclamation ;
- annulations et remboursements ;
- réachat à 30/90 jours ;
- distribution des opportunités entre professionnels éligibles ;
- taux de découverte des nouveaux professionnels ;
- marge contributive par catégorie et par commande ;
- coût d'acquisition complet, incluant le temps humain ;
- taux de recommandations refusées ou masquées ;
- incidents de sécurité, confidentialité et discrimination.

Garde-fous : aucune hausse de conversion ne justifie une dégradation importante de la satisfaction, de la sécurité, de l'équité d'accès ou de la marge.

## 10. Plan de réalisation frugal

Phase 0 — inventaire : cartographier les routes, données et écrans existants ; ne pas dupliquer les fonctions présentes.

Phase 1 — moteur déterministe : créer des fonctions pures de normalisation, éligibilité, scoring explicable, diversification et calcul de marge. Pas de modèle IA payant requis.

Phase 2 — tests : cas limites, données manquantes, égalités, nouveaux professionnels, disponibilités obsolètes, demandes ambiguës, biais de classement, consentement, annulation et retour arrière.

Phase 3 — pilote local : une catégorie, une zone, utilisateurs volontaires, données minimales, suivi humain et tableau de bord.

Phase 4 — apprentissage contrôlé : comparer les résultats à une règle de classement simple ; conserver l'algorithme plus complexe uniquement s'il améliore les résultats sans dégrader les garde-fous.

Phase 5 — graphe d'opportunités et Copilote : suggestions d'opportunités, scénarios et tâches avec autorisations graduées.

Phase 6 — extension : nouvelles catégories puis nouveaux territoires après revue juridique, fiscale, paiement, assurance, protection des données et support.

## 11. Architecture technique cible

Composants logiques découplés :
- Intent Parser (demande structurée et confirmée) ;
- Eligibility Engine (règles strictes) ;
- Candidate Retrieval (recherche des offres disponibles) ;
- Explainable Ranker (score versionné) ;
- Diversity Controller (limite la concentration) ;
- Opportunity Graph (relations et hypothèses) ;
- Outcome & Margin Ledger (résultats et marge) ;
- Experiment Registry (tests, témoins, version et rollback) ;
- Copilot Policy Gateway (droits, validations et journal).

Le moteur doit commencer par des règles déterministes testables. Un modèle d'apprentissage ne sera introduit que lorsqu'il existe assez de données de qualité, une métrique fiable, une justification documentée et un mécanisme de retour arrière. Aucun LLM ne doit décider seul d'un paiement, d'une suspension, d'une certification ou d'une obligation contractuelle.

## 12. Critères d'acceptation avant activation

- Score reproductible et versionné.
- Conditions d'éligibilité appliquées avant le classement.
- Prix et disponibilité issus de données serveur récentes.
- Aucune commission utilisée comme signal de classement organique.
- Explication de la recommandation disponible.
- Consentement et désactivation testés.
- Tests de biais et de concentration documentés.
- Calcul de marge rapproché des données financières.
- Journalisation et retour arrière opérationnels.
- Tests de charge, sécurité, confidentialité et intégration exécutés dans l'environnement cible.
- Validation juridique/DPO pertinente avant traitement réel.

## 13. Décision de gouvernance

Cette spécification n'autorise ni collecte nouvelle, ni dépense, ni activation IA payante, ni modification de classement en production. Le développement se fait sur la branche de préproduction, avec données fictives et tests automatisés. Tout déploiement, migration, nouveau service payant ou traitement de données réelles nécessitera une validation distincte.

Le succès ne sera pas déclaré sur la base d'une promesse. Il sera démontré par des résultats mesurés, reproductibles et auditables.


---

## 14. PROCHÉLIA NEXUS — moteur de création d'opportunités composées

### 14.1 Principe distinctif

NEXUS ne cherche pas uniquement à prédire quel contenu intéressera une personne. Il cherche à résoudre un objectif et à découvrir si plusieurs ressources, compétences, disponibilités et demandes peuvent être assemblées pour créer une solution nouvelle.

Un résultat NEXUS n'est donc pas seulement une recommandation individuelle. Il peut être :
- une mise en relation directe ;
- une combinaison de plusieurs professionnels ;
- un nouveau service construit à partir de besoins récurrents ;
- une collaboration entre un créateur, un artisan et un commerce ;
- une proposition d'atelier, de tournée ou de service groupé ;
- une alerte de demande non satisfaite destinée à un opérateur local.

La nouveauté revendiquée est cette boucle intégrée « intention → ressources → combinaison → simulation → test → résultat → apprentissage ». Elle doit être comparée à l'état de l'art et validée par des résultats ; ce document ne prétend pas établir une supériorité mondiale ni une brevetabilité.

### 14.2 Les sept mécanismes de NEXUS

**1. Intentions en réseau.** Au lieu d'enregistrer uniquement des clics, structurer les objectifs explicitement exprimés, leurs contraintes, leur échéance et leur degré de certitude. Les demandes semblables peuvent être agrégées sous forme de tendances anonymisées lorsque les seuils de confidentialité le permettent.

**2. Détecteur de besoins orphelins.** Identifier les demandes sans offre éligible, les devis sans réponse, les délais excessifs et les besoins récurrents. Chaque signal comporte sa période, son volume, sa représentativité et ses limites. Un signal faible reste une hypothèse, pas une vérité.

**3. Graphe de capacités composables.** Relier des capacités vérifiées, des disponibilités, des zones, des équipements et des autorisations nécessaires. Le moteur peut rechercher une combinaison de plusieurs acteurs, mais ne peut jamais supposer qu'une compétence, une assurance ou une autorisation existe.

**4. Compositeur de solutions.** Générer plusieurs scénarios réalisables : solution simple, solution multi-professionnels, solution locale groupée, atelier ou offre récurrente. Chaque scénario doit préciser les acteurs nécessaires, l'ordre des tâches, les dépendances, le délai, le prix estimé, les risques et les validations manquantes.

**5. Simulateur contrefactuel.** Comparer « si nous ne faisons rien », « si nous proposons une mise en relation », « si nous assemblons deux compétences » et « si nous testons une offre locale ». Estimer les résultats avec des hypothèses visibles, des intervalles d'incertitude et des coûts complets. Ne pas présenter une prévision comme une garantie.

**6. Marché d'opportunités à consentement réciproque.** Les personnes éligibles reçoivent une proposition claire et peuvent accepter, refuser ou se retirer. Aucun professionnel n'est engagé avant son accord ; aucune demande client n'est transmise à un tiers sans base légale et information appropriée. Les rémunérations, commissions et frais sont visibles avant acceptation.

**7. Boucle d'apprentissage à double résultat.** Apprendre à partir du résultat côté demandeur et côté fournisseur : besoin résolu, qualité, rémunération nette, temps mobilisé, coût, marge, litige et volonté de recommencer. Une transaction rentable mais insatisfaisante ne constitue pas un succès.

### 14.3 Fonction objectif multi-parties

NEXUS ne doit pas optimiser une métrique unique telle que le clic, le temps d'écran, le volume de commandes ou la commission.

Pour chaque scénario, il mesure séparément :
- utilité et satisfaction du demandeur ;
- revenu net et qualité de l'opportunité pour le professionnel ;
- marge contributive et risque opérationnel pour PROCHÉLIA ;
- respect des règles, de la confidentialité et de l'équité d'accès.

Les contraintes de sécurité, de consentement, de légalité, d'éligibilité et de capacité sont des conditions bloquantes, jamais des variables que le score peut compenser. Parmi les scénarios conformes, le moteur compare les compromis et expose les gagnants et perdants potentiels. Il peut proposer plusieurs options au lieu de masquer les arbitrages derrière un score opaque.

### 14.4 Exemple de fonctionnement

Hypothèse fictive : dans une zone donnée, plusieurs familles demandent un accompagnement à domicile et des repas préparés, tandis que des professionnels locaux ont des disponibilités complémentaires.

NEXUS pourrait :
1. détecter la répétition de besoins suffisamment documentés ;
2. vérifier que les demandes sont réellement compatibles et que les données peuvent être agrégées sans réidentifier les personnes ;
3. identifier des professionnels dont les compétences, disponibilités et autorisations sont vérifiées ;
4. proposer séparément une solution d'accompagnement et une offre de repas, ou un partenariat si les règles le permettent ;
5. calculer prix total, rémunérations, frais, risques et marge ;
6. solliciter l'accord des professionnels et des clients ;
7. lancer un pilote limité, puis comparer satisfaction, délais, coût et réachat.

Aucune donnée de santé ou situation personnelle sensible n'est nécessaire à la recommandation commerciale. Si une activité implique des informations sensibles ou réglementées, elle doit suivre une analyse dédiée et des contrôles renforcés.

### 14.5 Algorithme de génération de scénarios

Pseudo-pipeline :
1. prendre une intention confirmée et ses contraintes explicites ;
2. récupérer uniquement les ressources autorisées et à jour ;
3. appliquer les règles bloquantes d'éligibilité ;
4. construire un ensemble limité de combinaisons réalisables ;
5. éliminer les combinaisons redondantes, surchargées ou économiquement incohérentes ;
6. calculer coût complet, bénéfices attendus, incertitude et risques ;
7. conserver des scénarios diversifiés et expliquer leurs différences ;
8. demander les accords requis ;
9. lancer un test limité ;
10. comparer les résultats observés aux hypothèses et mettre à jour les modèles.

Le moteur doit imposer des limites de calcul, une profondeur maximale de combinaison et des quotas par demande afin d'éviter les explosions combinatoires et les coûts cachés.

### 14.6 Défenses contre les effets pervers

- Pas de fausse rareté, de pression artificielle, de dark patterns ou de notifications manipulatrices.
- Pas de vente de priorité organique cachée.
- Pas d'exclusion automatique des nouveaux acteurs faute d'historique : un parcours de découverte contrôlé doit leur être accessible.
- Pas de sur-optimisation des professionnels les plus disponibles au détriment de leur rémunération ou de leur bien-être.
- Pas de création de demande artificielle pour gonfler le GMV.
- Pas de révélation de demandes individuelles aux autres utilisateurs.
- Pas de coordination de prix entre concurrents ni d'échange d'informations commerciales confidentielles.
- Pas de proposition multi-acteurs sans vérifier responsabilités, assurances, contrats et autorisations.
- Un bouton de refus, de retrait et de contestation doit être disponible.

### 14.7 Première version technique sans coût logiciel additionnel obligatoire

Construire d'abord NEXUS comme moteur déterministe local au Worker :
- fonctions pures de génération et de validation des scénarios ;
- données fictives dans les tests ;
- règles et poids versionnés dans le code ou une configuration contrôlée ;
- recherche bornée sur les offres déjà disponibles ;
- calculs en centimes entiers ;
- journal d'explication et identifiant de version ;
- aucune API IA externe nécessaire pour la première version.

Ne pas créer une nouvelle base vectorielle, un service d'IA payant ou un moteur de graphe spécialisé tant qu'un test ne démontre pas que les solutions déjà disponibles sont insuffisantes. Le graphe peut commencer sous forme de relations structurées dans les tables existantes, après audit du schéma.

### 14.8 Tests d'acceptation NEXUS

Le moteur ne peut être activé qu'après des tests démontrant :
- aucune combinaison contenant un acteur non éligible ;
- aucune disponibilité dépassée ou périmée ;
- aucune proposition dépassant le budget sans avertissement et accord ;
- aucune rémunération ou marge calculée avec des nombres flottants non contrôlés ;
- aucun engagement sans consentement des parties ;
- aucune fuite d'informations entre demandes ;
- aucune recommandation pay-to-win cachée ;
- résultats reproductibles pour une même version et les mêmes entrées ;
- scénarios alternatifs, limites de calcul et cas sans solution ;
- audit des biais, concentration et taux de faux positifs ;
- tests de sécurité, charge, confidentialité et reprise.

Les tests unitaires ne remplacent pas les tests d'intégration, la revue juridique, les tests utilisateurs ni la validation de l'environnement de production.

### 14.9 Mesure de supériorité réelle

Toute affirmation « plus puissant qu'un autre algorithme » doit être testée sur une tâche et une population définies. Comparer NEXUS à :
- une recherche classique par filtres ;
- un classement simple par pertinence ;
- le moteur ORIGIN sans composition multi-acteurs ;
- NEXUS avec génération de scénarios.

Comparer à données et périodes comparables : taux de besoin résolu, délai, satisfaction des deux côtés, marge contributive, distribution des opportunités, incidents et coût d'exploitation. Pré-enregistrer les métriques principales, utiliser un groupe témoin lorsque c'est éthique et faisable, publier les résultats négatifs et ne pas généraliser au-delà de l'échantillon.

Le critère de réussite est une amélioration robuste de la résolution des besoins et de la valeur créée pour plusieurs parties, sans dégradation des garde-fous. La durée d'écran et les clics ne sont pas des critères de victoire.

### 14.10 Frontière entre suggestion et action

NEXUS peut analyser et proposer automatiquement. Il ne peut pas, sans approbation appropriée :
- publier une nouvelle offre ou modifier un tarif ;
- réserver un professionnel ou confirmer un engagement ;
- contracter avec un partenaire ;
- lancer une publicité ou engager une dépense ;
- transférer de l'argent ou modifier un portefeuille ;
- décider seul d'une suspension ou d'une sanction ;
- lancer un pays, une catégorie réglementée ou une activité nouvelle.

Chaque action autorisée est traçable, révocable et limitée à son périmètre.
