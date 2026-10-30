# PROCHÉLIA LIFE — Stratégie zéro dépense supplémentaire au démarrage

Date : 30 octobre 2026  
Statut : stratégie de pré-lancement — aucune dépense ni activation de service externe autorisée par ce document.

## 1. Objectif et règle de gouvernance

Objectif : construire, vérifier et lancer un pilote limité en minimisant les décaissements supplémentaires, en utilisant d'abord les outils, comptes, quotas et compétences déjà disponibles.

Règle impérative : aucun abonnement, achat de domaine, campagne publicitaire, service payant, montée en gamme, activation de paiement réel, migration destructive ou déploiement de production sans validation explicite de la gérante. Avant toute décision, présenter le coût total, les limites du gratuit, les risques de dépassement et une alternative.

« Gratuit » signifie sans nouveau décaissement immédiat, pas sans coût économique, ni garantie de disponibilité, sécurité ou conformité.

## 2. Architecture de lancement frugale

- Réutiliser le dépôt GitHub existant et travailler exclusivement sur la branche de préproduction.
- Prioriser les outils et quotas déjà inclus dans les comptes existants. Vérifier leurs conditions et limites actuelles avant de dépendre d'eux.
- Conserver l'architecture API actuelle tant qu'un test ne démontre pas qu'une refonte est nécessaire.
- Utiliser des environnements de test, des données fictives et des PSP en mode test ; aucune carte réelle ni aucun paiement réel pendant les tests.
- Éviter les microservices, outils SaaS, agents payants et doublons fonctionnels tant que le volume ne les justifie pas.
- Construire d'abord un parcours minimal complet dans un seul territoire et une seule famille de prestations.

## 3. Séquence de lancement sans publicité payante

1. Entretiens et tests manuels avec un petit groupe de clients et de professionnels volontaires.
2. Page de présentation légère, formulaires et prise de contact avec les moyens déjà disponibles.
3. Référencement organique : pages locales utiles, fiches métiers, réponses aux questions fréquentes, données structurées seulement si techniquement et juridiquement pertinentes.
4. Parrainage simple et traçable, sans récompense financière non budgétée.
5. Partenariats locaux, associations, commerces et créateurs avec accord explicite et suivi des résultats.
6. Démonstrations et contenus utiles ; les fonctions LIVE ne sont développées que lorsqu'un besoin et un modèle de conversion sont validés.
7. CRM minimal et consentement documenté ; pas de collecte ou d'import de contacts sans base légale.

Le temps consacré, les déplacements, la création de contenu, le support et les outils ont un coût économique : ils doivent être suivis même s'ils ne génèrent pas de facture.

## 4. Modèle économique et discipline de marge

Pour chaque commande, calculer séparément :
- montant payé par le client ;
- taxes et éléments collectés pour le compte de tiers ;
- rémunération due au professionnel ;
- frais du prestataire de paiement ;
- commission PROCHÉLIA réellement acquise ;
- remboursements, litiges, fraude et coût de support ;
- marge contributive après coûts variables.

Ne jamais assimiler le volume d'affaires (GMV), les fonds détenus pour les professionnels, les encaissements PSP et le chiffre d'affaires propre de PROCHÉLIA. Ne jamais financer les dépenses de l'entreprise avec les fonds dus aux professionnels.

Aucun prix n'est fixé uniquement pour paraître moins cher. La tarification doit couvrir les coûts variables, le risque, le support et les obligations applicables, tout en restant compréhensible et compétitive.

## 5. Tableau de contrôle obligatoire

Avant chaque activation, documenter :
- service et fournisseur ;
- plan gratuit ou déjà payé ;
- plafond d'usage et conditions de sortie ;
- coût marginal et coût en cas de dépassement ;
- données traitées et localisation ;
- dépendance technique et solution de remplacement ;
- responsable et date de réévaluation.

Indicateurs hebdomadaires : dépenses en euros, coûts variables par commande, marge contributive, coût d'acquisition complet (y compris temps humain), taux de conversion, réachat, annulations, remboursements, litiges, délai de réponse et satisfaction.

Seuils de blocage : toute dépense non approuvée ; toute marge contributive négative non expliquée ; tout écart de rapprochement financier ; toute faille critique ; tout traitement de données sans base légale identifiée.

## 6. Ce qui ne doit pas être sacrifié pour rester gratuit

Ne pas supprimer ou contourner : authentification, contrôle d'accès, sauvegardes vérifiées, chiffrement adapté, journalisation, protection des données, assurance pertinente, obligations fiscales/sociales, sécurité alimentaire ou professionnelle selon l'activité, support des litiges, tests de restauration et revue juridique.

Un service gratuit qui expose les données, bloque l'activité, limite les droits des utilisateurs ou rend les paiements non fiables n'est pas une économie acceptable.

## 7. Conditions de passage du pilote à la croissance

Ne financer une nouvelle dépense que si :
1. le besoin est prouvé par des utilisateurs actifs ou une contrainte de conformité/sécurité ;
2. le coût complet est chiffré ;
3. la marge et la trésorerie peuvent l'absorber ;
4. l'alternative gratuite ou déjà disponible est insuffisante ;
5. un responsable, un plan de retour arrière et des critères de succès sont définis ;
6. la gérante a approuvé explicitement la dépense.

L'internationalisation n'est pas activée automatiquement : chaque pays doit passer une revue locale juridique, fiscale, paiement, assurance, protection des données et opérations.

## 8. État actuel et limites

Ce document est une politique de pilotage. Il ne prouve pas que l'hébergement, les services tiers, les comptes, les quotas ou les obligations sont gratuits. Les tarifs et limites des fournisseurs doivent être vérifiés dans leurs consoles et contrats au moment de l'activation.

Le dépôt de l'API seul ne permet pas de certifier les trois interfaces, le parcours client complet, la conformité de chaque activité ni l'exploitation réelle. Aucun déploiement de production, paiement réel ou engagement financier n'est autorisé par ce plan.
