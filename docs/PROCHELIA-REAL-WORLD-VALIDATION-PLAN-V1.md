# PROCHÉLIA / NEXUS — protocole de validation par données réelles (v1)

**Statut : protocole prêt à exécuter, pas validation accomplie.** Les résultats ne seront qualifiés de réels que s'ils proviennent de participants consentants, de transactions/paiements effectivement enregistrés, de factures/coûts vérifiables ou de sources publiques citées. Aucune valeur ne doit être inventée.

## 1. Les cinq hypothèses à valider

| Hypothèse | Méthode de preuve | Indicateurs | Décision |
|---|---|---|---|
| Besoin marché | Entretiens + test de demande réel | problème récent, fréquence, solution actuelle, intention comportementale, demandes déposées | poursuivre/segmenter/arrêter |
| Marge | Coûts réels par transaction et prix testés | contribution/mission, frais PSP, coûts IA/SMS, support, CAC, remboursements | marge positive par segment |
| Coûts | Factures, métriques infra, temps humain | coût fixe, coût variable, coût support, coût par utilisateur/mission | budget réel + scénario prudent |
| Conformité | Cartographie obligations + revue professionnelle | risques ouverts, responsable, preuve, échéance, validation | pas de lancement si blocage critique |
| Fidélisation | Cohortes clients et intervenants | réachat/réactivation 30/60/90 jours, rétention, churn, satisfaction | valeur récurrente équilibrée |

## 2. Pilote terrain — 30 jours, France
**Zone/catégorie à sélectionner avec les données, pas au hasard.** Ne pas lancer toutes les catégories simultanément. Pour chaque catégorie : entretiens séparés côté demande et côté offre, observation des alternatives actuelles, test d'une offre transparente, puis missions pilotes réelles uniquement si statut, contrats, assurance, paiements et conformité sont validés.

Échantillon initial indicatif (pas une norme statistique) :
- 15–25 clients potentiels/acheteurs, dont au moins 5 ayant acheté récemment;
- 15–25 intervenants/professionnels, dont au moins 5 ayant récemment reçu des demandes;
- 5–10 entreprises/partenaires éventuels;
- 10 tests d'utilisabilité de prototype;
- 20–50 demandes qualifiées comme première cohorte opérationnelle, uniquement si les prérequis sont réunis.

Ne pas compter les likes, « j'aime l'idée » ou inscriptions sans action comme preuve de demande. Prioriser : demande réelle, devis accepté, réservation, paiement conforme, mission achevée, réutilisation.

## 3. Guide d'entretien sans biais
1. Racontez la dernière fois que vous avez eu ce besoin.
2. Comment l'avez-vous résolu ? Combien de temps et d'argent ?
3. Qu'est-ce qui a mal fonctionné ? Quelle conséquence concrète ?
4. À quelle fréquence cela arrive-t-il ?
5. Qu'avez-vous réellement payé la dernière fois (fourchette si nécessaire) ?
6. Qu'est-ce qui vous ferait refuser une solution ?
7. Seriez-vous prêt à déposer une demande/essayer un pilote maintenant ? Pourquoi ?
8. Pour l'intervenant : revenu net souhaité, frais, déplacement, annulations, délais de paiement, disponibilité.
Ne pas commencer par présenter NEXUS/SUPRA comme révolutionnaire : éviter d'influencer les réponses.

## 4. Événements produit à enregistrer (minimisation RGPD)
- landing_view
- search_started / search_results
- profile_view
- request_created
- quote_sent / quote_accepted
- booking_confirmed
- payment_authorized
- mission_started / mission_completed
- payment_settled
- cancelled / refund_requested / dispute_opened
- case_resolved
- repeat_booking

Chaque événement doit porter un ID pseudonyme, timestamp, source/canal, catégorie/zone grossière, étape et version du prix; éviter adresse exacte, données sensibles et texte libre en analytics. Identité/transaction restent dans systèmes métier à accès restreint. Documenter base légale, finalité, durée, droits et sous-traitants; ne pas activer de traceurs non essentiels avant consentement requis.

## 5. Registre des coûts réels
Collecter :
- factures hosting, stockage, logs, domaine et outils;
- frais PSP par paiement, remboursement, litige, payout et FX;
- coûts IA/inférence, SMS/email, stockage par utilisateur/mission;
- minutes de support, modération, vérification identité;
- marketing par canal, temps de vente et acquisition;
- assurance, comptabilité, juridique, taxes et frais fixes;
- temps fondateur (même non rémunéré actuellement).

Séparer dépenses cash, coût économique du travail fondateur, coûts fixes/variables et dépenses ponctuelles. Conserver factures/contrats et dates. Aucun coût estimé ne doit être présenté comme réel.

## 6. Calculs
- Contribution transaction = revenus plateforme HT réellement acquis − frais PSP − coûts variables (support, IA/SMS, vérification, remboursement/perte, acquisition variable).
- Contribution par segment/canal/cohorte; afficher nombre d'observations et incertitude.
- CAC = coûts acquisition attribuables / nouveaux clients payants; séparément intervenants activés.
- Réachat 30/60/90 jours = clients de cohorte ayant un nouvel achat dans la fenêtre / clients éligibles.
- Rétention intervenants = intervenants de cohorte encore disponibles/actifs / intervenants de la cohorte.
- Seuil mensuel = coûts fixes récurrents / contribution moyenne positive par mission. Si contribution ≤ 0, la croissance du volume seule ne suffit pas.
- GMV n'est ni chiffre d'affaires plateforme ni bénéfice.

## 7. Conformité — preuves à conserver
Revue par professionnels compétents en France/UE :
- rôle réel de PROCHÉLIA, intermédiation, responsabilités et statut des intervenants;
- droit du travail/statut indépendant et risque de requalification;
- contrats, CGU/CGV, prix, frais, annulations, réclamations, droit de consommation;
- rôle PSP, détention/transfert de fonds, marketplace, split/payout;
- fiscalité, TVA, facturation, obligations plateforme et déclarations;
- RGPD/CNIL : finalités, minimisation, bases légales, consentements, droits, conservation, sécurité, sous-traitants, transferts, DPIA si nécessaire;
- DSA et obligations plateforme si applicables; vérification professionnels et transparence;
- assurances, sécurité, utilisateurs vulnérables et catégories réglementées;
- accessibilité, cybersécurité, incidents et preuves.
Aucune coche ne signifie « conforme » sans document, responsable, date et approbateur. Ce document n'est pas un avis juridique.

## 8. Fidélisation
Analyser par cohorte, canal, segment et catégorie :
- première demande → première mission achevée;
- délai jusqu'à première valeur;
- seconde mission dans 30/60/90 jours;
- fréquence, annulations et litiges;
- rétention et disponibilité intervenants;
- raisons de départ, désactivation et refus;
- satisfaction après usage, pas seulement inscription.
Respecter les bases légales/consentements applicables aux relances et offrir une désinscription simple.

## 9. Critères GO / HOLD / STOP
**GO pilote élargi** uniquement si demandes comportementales crédibles, offre active suffisante, missions réussies, contribution positive ou trajectoire démontrée, rétention prometteuse, support gérable, aucun blocage critique légal/sécurité/PSP.

**HOLD** si données insuffisantes, biaisées, cohortes trop jeunes ou coûts incomplets.

**STOP/REDESIGN** si contribution structurellement négative, conversion faible après itérations, intervenants perdent de l'argent, confiance faible, litiges excessifs ou blocage réglementaire.

## 10. Tableau de bord de décision
Pour chaque KPI : définition, formule, source, date, période, nombre d'observations, segment, responsable, qualité (observé/estimé/manquant), seuil de décision et commentaire.
État initial : **UNKNOWN / NON MESURÉ**. Ne jamais remplacer les inconnues par des valeurs arbitraires.
