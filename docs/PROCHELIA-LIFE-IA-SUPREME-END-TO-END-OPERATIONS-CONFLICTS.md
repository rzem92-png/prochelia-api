# PROCHÉLIA LIFE — IA SUPRÊME : gestion opérationnelle de bout en bout et résolution des conflits

**Statut :** spécification fonctionnelle à implémenter et tester.  
**Branche cible :** prelaunch/v14.5.7-consolidation-audit  
**Principe :** l'IA pilote le dossier de bout en bout, mais les décisions engageant des droits, la sécurité, des fonds ou la responsabilité juridique suivent des règles d'approbation explicites.

## 1. Mission opérationnelle

L'IA SUPRÊME orchestre les workflows de PROCHÉLIA LIFE : demande, qualification, disponibilité, devis, réservation, paiement, exécution, preuve de réalisation, suivi, facturation, réclamation, médiation, remboursement ou clôture.

Elle doit :
- détecter les anomalies et retards ;
- ouvrir et catégoriser les dossiers ;
- recueillir les éléments utiles auprès de chaque partie ;
- rapprocher mission, devis, échanges, preuves, paiement et historique ;
- proposer et suivre un plan de résolution ;
- informer chaque partie avec des messages adaptés ;
- relancer dans les limites autorisées ;
- vérifier la réalisation des actions ;
- escalader les cas sensibles et conserver une piste d'audit.

L'IA ne doit jamais prétendre qu'un dossier est résolu tant que les critères de clôture ne sont pas vérifiés.

## 2. Cycle de vie d'un conflit

1. **Détection et ouverture** : signalement client, intervenant, partenaire, système de paiement, incident ou détection d'anomalie.
2. **Accusé de réception** : confirmer l'ouverture, fournir un identifiant et expliquer les prochaines étapes et délais indicatifs.
3. **Triage** : identifier le type de dossier, l'urgence, les risques de sécurité, les personnes concernées et les transactions liées.
4. **Mesures conservatoires** : préserver les preuves et prévenir une nouvelle opération risquée. Ne pas bloquer arbitrairement les revenus ou comptes ; appliquer seulement les mesures autorisées, proportionnées et contestables.
5. **Collecte contradictoire** : demander séparément les explications et pièces aux parties, avec délais raisonnables et possibilité de répondre.
6. **Vérification** : examiner les éléments, leur cohérence, les horodatages, les statuts PSP, les règles contractuelles et les politiques publiées.
7. **Analyse** : distinguer faits établis, déclarations, éléments manquants et hypothèses. Ne jamais présenter une inférence comme une preuve.
8. **Proposition** : préparer des options de résolution compréhensibles, proportionnées et conformes aux contrats et règles applicables.
9. **Validation** : exécuter automatiquement uniquement les solutions préautorisées, réversibles, plafonnées et non sensibles. Obtenir l'approbation requise pour les décisions à impact élevé.
10. **Exécution** : coordonner remboursement autorisé, correction de facture, reprise de mission, avoir, geste commercial approuvé, médiation ou transfert à un partenaire compétent.
11. **Suivi** : vérifier les statuts de paiement et les engagements de chaque partie.
12. **Clôture** : confirmer le résultat, les éventuelles voies de recours, le motif et les pièces conservées.
13. **Apprentissage** : identifier la cause racine et proposer une correction produit ou opérationnelle, sans réutiliser des données personnelles au-delà des finalités autorisées.

## 3. Classification et priorité

Catégories minimales :
- annulation, retard ou absence ;
- prestation incomplète ou non conforme ;
- désaccord sur le périmètre ou le prix ;
- paiement, double débit, remboursement ou payout ;
- comportement inapproprié, harcèlement, discrimination ou menace ;
- dommage matériel ou accident ;
- suspicion de fraude, usurpation ou faux justificatif ;
- confidentialité, accès ou fuite de données ;
- sécurité d'une personne vulnérable ;
- contestation d'une décision automatisée ;
- conflit entre partenaires ou entreprise et prestataire.

Niveaux :
- **P0 critique** : danger immédiat, violence, exploitation, risque grave pour une personne, incident de données majeur ou fraude en cours. Arrêt des actions automatisées non indispensables, consignes de sécurité et escalade immédiate vers les services d'urgence ou responsables compétents selon le pays.
- **P1 élevé** : préjudice financier important, sécurité potentiellement compromise, discrimination, menace ou blocage majeur. Traitement prioritaire et validation humaine.
- **P2 standard** : litige de prestation, retard, qualité ou facture. Gestion guidée avec examen contradictoire.
- **P3 simple** : question ou erreur administrative réversible. Automatisation permise dans les règles préapprouvées.

Les délais de traitement doivent être configurables par pays et catégorie, et ne doivent jamais être annoncés comme des délais légaux sans validation locale.

## 4. Matrice d'autonomie

### Automatisable sous règles préapprouvées
- accusé de réception et création de dossier ;
- collecte guidée de documents non sensibles nécessaires ;
- demandes de précisions et rappels ;
- rapprochement des statuts de mission et paiement ;
- détection de doublons et anomalies ;
- explication d'une politique publiée ;
- correction administrative réversible sans impact financier ou juridique ;
- clôture d'une demande d'information lorsque la réponse est confirmée.

### Approbation humaine obligatoire
- remboursement hors seuil ou remboursement contesté ;
- compensation, geste commercial ou modification de commission ;
- retenue, suspension ou libération exceptionnelle de fonds ;
- suspension ou fermeture d'un compte avec impact significatif ;
- décision sur un dommage, une responsabilité ou une faute contestée ;
- signalement externe, déclaration aux autorités ou assureurs ;
- conflit impliquant un mineur ou une personne vulnérable ;
- menace, violence, exploitation, harcèlement ou discrimination ;
- litige portant sur l'emploi, le statut d'un travailleur ou une requalification ;
- médiation formelle, transaction, renonciation à recours ou accord juridiquement engageant.

### Professionnels et autorités compétents
Avocat, médiateur qualifié, assureur, DPO, expert-comptable, PSP, services d'urgence ou autorité compétente selon la nature du dossier et le pays.

L'IA prépare le dossier et facilite l'orientation ; elle ne remplace ni un juge, ni un médiateur réglementé, ni les services d'urgence, ni un professionnel légalement requis.

## 5. Sécurité et équité

- Donner à chaque partie une possibilité réelle de présenter ses éléments.
- Ne pas déduire la culpabilité d'une note, d'un profil ou d'un historique statistique.
- Expliquer les règles appliquées et les éléments déterminants.
- Prévoir une contestation et une révision humaine.
- Ne pas pénaliser un intervenant pour avoir refusé une mission.
- Ne pas utiliser de notation opaque comme preuve unique.
- Protéger les personnes contre les représailles et limiter la visibilité des signalements.
- En cas de danger immédiat, prioriser la sécurité physique sur la poursuite du workflow commercial.
- Ne jamais demander à une personne de confronter directement un auteur présumé de violence ou de menace.
- Ne pas retarder une orientation urgente pour compléter le dossier administratif.

## 6. Dossier de conflit et traçabilité

Chaque dossier doit conserver :
- identifiant unique, pays, langue, dates et fuseau horaire ;
- personnes et rôles autorisés ;
- mission, devis, facture et transaction liés ;
- catégorie, priorité et justification ;
- chronologie des événements ;
- pièces et provenance, intégrité et droits d'accès ;
- déclarations distinctes des parties ;
- faits vérifiés, éléments contradictoires et éléments manquants ;
- recommandations de l'IA et niveau de confiance explicable ;
- validations humaines, motif et identité du validateur ;
- actions réalisées, résultat PSP et preuves d'exécution ;
- communication envoyée, recours et clôture ;
- politique de conservation et accès au dossier.

Les journaux doivent être protégés contre la modification non autorisée. Les pièces sensibles ne doivent être visibles qu'aux personnes ayant besoin d'en connaître.

## 7. Agents spécialisés

- **Case Intake** : ouvre et catégorise les dossiers.
- **Safety Sentinel** : repère les risques immédiats et déclenche l'escalade.
- **Evidence Coordinator** : collecte et organise les éléments.
- **Payment Reconciler** : rapproche les transactions et statuts PSP sans inventer un paiement.
- **Policy Interpreter** : applique les règles publiées et signale les ambiguïtés.
- **Resolution Planner** : prépare des options et évalue leur proportionnalité.
- **Communication Agent** : informe les parties sans accusation ni promesse infondée.
- **Follow-up Agent** : suit les engagements et relances.
- **Root Cause Analyst** : repère les causes récurrentes et propose des corrections.
- **Human Review Desk** : route les cas vers une personne autorisée ou un professionnel compétent.

Tous les agents opèrent sous permissions minimales, journalisation, budgets et arrêt d'urgence.

## 8. Architecture technique et intégration existante

Le backend contient déjà des mécanismes de cas opérationnels et de journalisation, ainsi que des recommandations Copilote qui distinguent certains cas automatiques des cas nécessitant une validation de la gérante.

La suite doit étendre ces mécanismes existants plutôt que créer un moteur concurrent :
- un registre unique des dossiers ;
- une machine à états explicite et versionnée ;
- une file de tâches idempotente avec reprise sûre ;
- un registre des règles et seuils par pays ;
- une table de preuves et une chronologie ;
- une file d'approbations humaines ;
- des connecteurs PSP avec rapprochement confirmé ;
- des notifications et délais configurables ;
- un tableau de bord des dossiers ouverts, urgents, en attente et clôturés.

Ne pas activer de nouvelles écritures financières ou actions de compte avant tests d'intégration et revue des permissions.

## 9. Indicateurs

- délai avant premier accusé de réception ;
- délai de triage et de résolution par catégorie ;
- taux de résolution au premier contact ;
- taux de réouverture et de contestation ;
- remboursements et ajustements correctement réconciliés ;
- part des dossiers escaladés ;
- erreurs et faux positifs de classification ;
- satisfaction des parties après résolution ;
- récurrence des causes racines ;
- incidents de sécurité, confidentialité et conformité.

La performance ne se mesure pas au nombre de conflits fermés rapidement. Une clôture injuste ou précipitée est un échec.

## 10. Tests d'acceptation obligatoires

- Un dossier P0 ne peut pas rester dans une file ordinaire.
- Les éléments des deux parties sont séparés et correctement attribués.
- Une déclaration non vérifiée n'est jamais présentée comme un fait.
- Aucun remboursement ou payout ne peut être marqué effectué sans confirmation du PSP.
- Les retries ne produisent pas de double remboursement ou double paiement.
- Toute action financière respecte les permissions, seuils et approbations.
- Toute suspension significative dispose d'un motif, d'une notification et d'une voie de recours.
- Le kill switch bloque les actions automatiques non essentielles.
- Les accès aux preuves et journaux sont testés par rôle.
- Les cas sensibles déclenchent une escalade humaine adaptée au pays.
- Les tests couvrent les pannes PSP, délais, doublons, preuves contradictoires, absence de réponse et réouverture.
- Les interfaces client, intervenant et gestion sont testées de bout en bout, séparément des tests API.

## 11. Règle de clôture

Un conflit est considéré comme résolu uniquement lorsque :
- la décision ou l'accord est documenté ;
- les validations nécessaires ont été obtenues ;
- les actions promises ont été exécutées et vérifiées ;
- les parties ont été informées ;
- les voies de contestation applicables ont été communiquées ;
- les éléments et durées de conservation sont conformes.

**Principe directeur :** l'IA SUPRÊME prend en charge le dossier du signalement à la vérification finale, résout seule les cas simples autorisés et escalade les cas sensibles pour protéger les personnes, les fonds et l'entreprise.
