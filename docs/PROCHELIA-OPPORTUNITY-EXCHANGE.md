# PROCHÉLIA OPPORTUNITY EXCHANGE
Version: 1.0
Statut: concept produit — étude et validation juridique requises avant implémentation

## 1. Vision

Transformer des besoins de services isolés en signaux de demande collective, puis permettre aux clients et aux intervenants autonomes de découvrir des opportunités compatibles.

PROCHÉLIA ne planifie pas le travail d'un indépendant à sa place et ne lui impose ni tournée, ni horaires, ni tarif, ni volume minimal. Le système révèle des possibilités; chaque client et chaque intervenant choisit librement de poursuivre.

Promesse: « Les besoins du quotidien deviennent visibles. Les opportunités deviennent accessibles. »

## 2. Le mécanisme de mutualisation de la demande

1. Les clients expriment des besoins précis ou récurrents, avec leur consentement.
2. Le système transforme les demandes en signaux agrégés par zone large, type de service et période, sans exposer les adresses ni les identités.
3. Il détecte les concentrations de besoins et les périodes sous-desservies.
4. Il informe les clients qu'une offre ou une disponibilité pourrait émerger, sans leur promettre une prestation.
5. Il présente aux intervenants éligibles des opportunités individuelles, avec les conditions et contraintes utiles.
6. L'intervenant choisit librement de manifester son intérêt, de proposer ses conditions et de refuser.
7. Le client choisit parmi les propositions et confirme séparément la prestation.
8. Chaque mission est contractualisée et tarifée individuellement selon le modèle légal applicable.

Aucun engagement de mission, créneau, tournée ou prix n'est créé par la seule agrégation d'une demande.

## 3. Pourquoi cela peut être différenciant

- Réduit l'invisibilité des petits besoins dispersés.
- Permet d'identifier les zones où la demande existe réellement avant d'investir dans l'acquisition.
- Aide les intervenants autonomes à découvrir des clients potentiels proches, sans leur imposer un itinéraire.
- Peut améliorer la continuité pour les familles grâce à plusieurs propositions et à un plan de secours consenti.
- Produit des données agrégées utiles pour les partenaires locaux, sous réserve d'une base légale et d'une anonymisation adéquates.
- Crée un effet de réseau local: plus les demandes et offres volontaires sont nombreuses, plus la plateforme détecte les opportunités.

## 4. Fonctionnalités produit

### Client
- Déclarer un besoin ponctuel ou récurrent.
- Choisir si le besoin peut contribuer aux tendances locales agrégées.
- Voir les opportunités émergentes sans révéler les informations des autres clients.
- Recevoir des propositions et choisir librement.
- Définir un plan de continuité et des personnes de confiance avec permissions séparées.

### Intervenant
- Définir ses services, tarifs, zone souhaitée, disponibilités et préférences.
- Voir les opportunités compatibles et comprendre pourquoi elles sont affichées.
- Choisir de répondre, de proposer d'autres conditions ou de passer.
- Ne pas être pénalisé pour un refus ou une absence de réponse.
- Garder la maîtrise de ses créneaux, déplacements et acceptations.

### PROCHÉLIA SUPRÊME
- Agréger et analyser les signaux autorisés.
- Détecter les zones et périodes sous-desservies.
- Prévoir la demande avec des niveaux de confiance et des limites explicites.
- Produire des propositions d'opportunités, jamais des affectations forcées.
- Contrôler les règles de service, les pièces et les restrictions.
- Mesurer conversion, missions réellement réalisées, satisfaction, incidents et marge.
- S'arrêter si le volume est trop faible, si les données sont périmées ou si un risque est détecté.

## 5. Règles de liberté et de responsabilité

- Pas d'exclusivité, de disponibilité imposée ou de quota de missions.
- Pas de pénalité algorithmique pour refus, déconnexion ou absence de réponse.
- Pas de prix imposé à un prestataire indépendant; les conditions de prix doivent refléter son autonomie réelle et le cadre juridique retenu.
- Pas de surveillance continue des déplacements. Une localisation ponctuelle ne peut être utilisée que pour une finalité clairement expliquée et acceptée, si elle est nécessaire.
- Pas de score secret, de classement opaque ou de blocage automatique.
- Explication des critères de recommandation, possibilité de correction et recours humain.
- Pas d'utilisation des données de santé, de handicap, d'origine ou autres données sensibles pour classer les intervenants.
- Aucun signal agrégé ne révèle un domicile, une routine individuelle ou une situation personnelle.
- Les besoins urgents, actes de soin et prestations réglementées sont orientés vers les circuits compétents, jamais convertis automatiquement en mission ordinaire.

## 6. Garde-fous réglementaires à instruire

Le modèle de plateforme doit être qualifié juridiquement selon les opérations réellement exercées, et non selon son intitulé contractuel. Faire examiner:
- le risque de lien de subordination ou de requalification;
- la directive européenne 2024/2831 relative au travail via une plateforme et sa transposition française;
- le règlement européen sur l'IA si des systèmes participent au recrutement, à la sélection, à l'allocation de tâches ou à l'évaluation de personnes;
- les règles SAP et le mode d'intervention pour chaque activité;
- les obligations d'information, de transparence, de protection des données, de sécurité et de consommation.

L'IA peut recommander des opportunités mais ne doit pas prendre seule de décisions significatives affectant l'accès d'une personne au travail ou à une activité indépendante. Toute fonctionnalité de matching doit faire l'objet d'une analyse juridique et d'impact appropriée avant activation.

## 7. Données et architecture

Tables conceptuelles proposées, à adapter au schéma existant:
- demand_intents: besoin déclaré, fréquence, catégorie, fenêtre souhaitée, état et consentement;
- demand_aggregation_cells: zone suffisamment large, période, catégorie, volume agrégé, seuil de confidentialité;
- opportunity_signals: signal, confiance, date d'expiration, provenance et règles appliquées;
- provider_preferences: catégories choisies, zone volontaire, disponibilité publiée, préférences;
- opportunity_views: propositions montrées et explications;
- opportunity_responses: intérêt, refus volontaire, contre-proposition, expiration;
- client_quotes: devis individuels et version des règles tarifaires;
- consent_events: finalité, version, horodatage, retrait;
- fairness_reviews: résultats d'audit, anomalies, mesures correctives.

Ne pas conserver un refus comme signal négatif de performance. Limiter la granularité géographique et appliquer un seuil minimum de personnes/demandes avant affichage d'une tendance. Les données brutes doivent être protégées, conservées le moins longtemps possible et séparées des statistiques agrégées.

## 8. Mesure de la valeur

- demandes agrégées devenues opportunités;
- opportunités consultées et réponses volontaires;
- délai entre demande et proposition;
- taux de missions réellement réalisées;
- récurrence client et continuité consentie;
- taux d'annulation et d'incidents;
- revenu réellement perçu par intervenant, sans promesse de revenu;
- marge contributive par zone et service;
- taux de faux signaux et précision des prévisions;
- plaintes, recours, retraits de consentement et écarts de traitement.

## 9. Déploiement progressif

Phase 1: prototype avec données synthétiques et agrégation grossière.
Phase 2: pilote fermé avec consentement explicite, sans matching automatisé décisionnel.
Phase 3: recommandations explicables et réponse libre des clients/intervenants.
Phase 4: mesure de la valeur et audit des biais, de la vie privée et de la conformité.
Phase 5: extension géographique après validation des règles locales.

## 10. Critère de réussite

Le module réussit s'il révèle des besoins réels qui seraient restés invisibles, augmente les mises en relation consenties et les missions effectivement réalisées, tout en préservant la liberté des intervenants, la confidentialité des clients, la qualité des services et la rentabilité de PROCHÉLIA.

Il ne doit jamais devenir un système de dispatch qui dirige le travail des indépendants sous couvert d'une simple place de marché.


## 11. Précaution spécifique sur l'IA et l'accès aux opportunités

Le service officiel AI Act de la Commission européenne donne comme exemple de système à haut risque un outil de plateforme qui classe des prestataires indépendants et détermine lesquels sont présentés aux consommateurs. Par conséquent, le fait que les personnes soient indépendantes ne permet pas d'écarter automatiquement les règles relatives aux systèmes d'IA à haut risque.

Avant toute fonction de matching, de classement, de recommandation ou de présélection susceptible d'influencer l'accès aux missions:
- obtenir une analyse juridique documentée de la qualification au titre du règlement européen sur l'IA;
- cartographier les obligations applicables, notamment gestion des risques, gouvernance des données, documentation, journalisation, transparence, supervision humaine, robustesse et cybersécurité;
- ne pas lancer de score individuel, de classement algorithmique ou de présélection automatisée en production avant cette analyse et la satisfaction des obligations applicables;
- privilégier pour le prototype un affichage neutre, des filtres choisis par le client, des critères objectifs vérifiables et une présentation non hiérarchisée;
- permettre à l'intervenant de contrôler les informations publiées, corriger ses données et contester une erreur;
- vérifier périodiquement que les filtres ne produisent pas d'exclusion indirecte ou discriminatoire.

Le recours à une validation humaine ne suffit pas, à lui seul, à faire sortir un système du champ des systèmes à haut risque.
