# PROCHÉLIA — Blueprint produit, conformité multi-pays et NEXUS TALENT
Version: 1.0 — 20 novembre 2026
Statut: spécification produit/architecture à implémenter et valider — PAS une attestation de conformité ni une autorisation de production.

## 1. Décision produit non négociable

PROCHÉLIA est une plateforme multi-activités unifiée. NEXUS TALENT est un domaine natif de PROCHÉLIA, et non une application séparée. Il ne remplace ni les services de proximité, ni les parcours clients, entreprises et intervenants. Tous les domaines partagent une identité, une gouvernance, une facturation, un support et un socle de sécurité, mais leurs permissions, contrats, flux financiers et données restent cloisonnés.

Signature proposée: **« Du talent à l'activité réelle, sans dépendre d'un algorithme ni d'un public qui paie pour tout. »**
La différenciation ne doit pas reposer sur une promesse marketing d'être « meilleur que TikTok », mais sur un ensemble vérifiable: découverte équitable, espace professionnel exploitable par chaque talent, outils de vente et de réservation, revenus diversifiés, paiements traçables, accompagnement opérationnel par NEXUS SUPRA, et portabilité de l'activité.

## 2. Périmètre fonctionnel global à préserver

- Services: recherche, devis, réservation, mission, messagerie, preuve d'exécution, réclamation, médiation et clôture.
- Clients: compte, préférences, moyens de paiement via PSP, historique, suivi, assistance et recours.
- Intervenants: profil professionnel, compétences, justificatifs, disponibilité, zone, devis, agenda, missions, factures, revenus, réputation et support.
- Entreprises: pages vérifiées, catalogue, demandes, contrats, campagnes, facturation et tableaux de bord.
- NEXUS TALENT: découverte des talents et entreprises, pages/mini-sites professionnels, portfolio, vidéos, lives, événements, ateliers, réservations, contenus numériques, offres et communauté.
- Économie créateur: accès gratuit par défaut pour les spectateurs; soutien volontaire, pourboires si autorisés, contenus/ateliers payants facultatifs, réservation, vente, abonnements transparents, événements et partenariats commerciaux clairement signalés.
- NEXUS SUPRA: gouvernance et assistance transverses, tarification assistée, détection de fraude/anomalies, orchestration, support, conformité opérationnelle, analytics, alertes et supervision.
- Finance: ledger immuable ou append-only, rapprochement, commissions explicites, remboursements, litiges, réserves, factures et exports comptables.
- International: règles par pays, devise, langue, fiscalité, paiements, protection des données, consommation, travail/prestation, publicité et propriété intellectuelle.
- Administration: gestion des rôles, incidents, signalements, modération, demandes réglementaires, audits et continuité.

## 3. NEXUS TALENT — expérience et signature

### 3.1 Découverte juste et utile
- Recherche par compétence, lieu/pays, disponibilité, langue, catégorie, format et besoin réel.
- Découverte de nouveaux profils sans exiger une audience initiale; rotation contrôlée et plafonds d'exposition pour éviter que seuls les comptes déjà populaires dominent.
- Classement explicable, critères documentés, détection de manipulation et possibilité de signaler/corriger un profil.
- Les contenus sponsorisés sont identifiés; aucun paiement ne doit acheter silencieusement une meilleure réputation.
- Recommandations configurables, diversité des résultats, contrôle utilisateur et absence de dark patterns.

### 3.2 Studio professionnel intégré
Chaque talent peut disposer d'un espace public personnalisable et d'outils:
- profil, bio, portfolio, calendrier, liens, catalogue et coordonnées protégées;
- studio vidéo/live, modération, sous-titres, signalement, contrôle de l'audience et paramètres de confidentialité;
- réservation de sessions, cours, ateliers et événements;
- vente de recettes, patrons, modèles, formations et autres contenus numériques licites;
- boutique ou demandes de devis selon les catégories autorisées;
- CRM léger: contacts consentis, réservations, messages et suivi;
- statistiques compréhensibles: conversion, revenus nets, frais, remboursements et audience;
- export des contenus et données dans des formats usuels, sous réserve des droits de tiers.

### 3.3 Accès abordable et monétisation sans péage obligatoire
- Un live peut être gratuit; le spectateur n'est jamais obligé d'acheter pour regarder un contenu annoncé comme gratuit.
- Les revenus du talent peuvent provenir de ventes ou réservations facultatives, contributions volontaires non manipulatrices, contenus premium, ateliers payants, abonnements, événements, commandes et partenariats.
- Afficher le prix total, les frais, la commission PROCHÉLIA, les taxes connues, les conditions d'annulation et le montant estimé net avant validation.
- Ne pas pousser les talents à solliciter des paiements ou cadeaux de façon coercitive; pas de mécanismes assimilables à du jeu d'argent ou de récompenses aléatoires payantes.
- Aucun revenu n'est garanti. Les projections sont clairement qualifiées d'estimations.

### 3.4 Paiement et versement
- Encaissement et versement par prestataire de services de paiement (PSP) autorisé dans le pays concerné; PROCHÉLIA ne conserve pas les données de carte.
- Ledger double entrée/équivalent contrôlé, idempotence, rapprochement PSP, journal d'audit et séparation stricte des soldes.
- Présenter le revenu brut, commission, frais PSP, taxes retenues le cas échéant, remboursements/réserves et net disponible.
- Versement cible 24–48 h uniquement si le PSP, le pays, le moyen de paiement, les contrôles KYC/AML, les délais de compensation et l'absence de litige le permettent. Sinon afficher le délai réel estimé; ne jamais promettre un délai non garanti.
- Contrôles anti-fraude, limites, réserve proportionnée et procédure de contestation; aucun blocage de fonds sans motif, information et voie de recours appropriés.
- Les fonds clients ne doivent pas être utilisés pour financer les versements d'autres utilisateurs.

## 4. NEXUS SUPRA — directeur exécutif sous contrôle

NEXUS SUPRA peut fonctionner en continu comme système de supervision et d'orchestration si l'infrastructure, les équipes d'astreinte et les contrats fournisseurs le permettent. « 24/7 » est un objectif opérationnel mesuré par SLA/SLO, pas une garantie absolue.

### Autorisé en autonomie après tests et délégation explicite
- surveillance de disponibilité, files, erreurs, latence, fraude et anomalies;
- catégorisation des demandes, réponses d'assistance de premier niveau, relances non sensibles;
- recommandations de prix basées sur coûts, demande, zone, saison et règles locales; fourchettes explicables, validation du professionnel pour ses propres prix;
- détection des écarts, suspension préventive limitée et réversible selon règles publiées, avec revue humaine rapide;
- préparation de campagnes, contenus et plannings soumis aux autorisations du compte;
- rapprochements et rapports en lecture, sans écriture financière non autorisée;
- adaptation de langue, devise, formats et règles pays depuis un référentiel juridique versionné.

### Approbation humaine obligatoire
- changement des commissions, conditions contractuelles ou politiques de remboursement;
- versement exceptionnel, transfert de fonds, remboursement hors règles, modification du ledger;
- décision de bannissement définitif, fermeture de compte ou blocage durable;
- interprétation juridique, réponse à une autorité, notification réglementaire ou décision fiscale;
- changement de politique d'âge/identité, partage transfrontalier de données ou activation d'un nouveau pays;
- toute action présentant un risque élevé pour une personne, une entreprise ou les fonds.

### Garde-fous techniques
RBAC/ABAC et moindre privilège; séparation des tâches; secrets gérés hors code; journaux append-only; preuve de chaque décision (entrée, règle, version modèle, sortie, approbation); idempotence; quotas; circuit breakers; kill switch; files de reprise; sauvegardes chiffrées et restauration testée; alertes humaines; mode dégradé sûr; tests de reprise et exercices d'incident.

## 5. Protection des mineurs et vérification d'âge/identité

Règle produit demandée: accès réservé aux personnes de 18 ans et plus, pour les comptes et fonctionnalités PROCHÉLIA. Cette règle doit être traduite en contrôles serveur et en parcours de recours:
- vérification de majorité avant activation des fonctionnalités réservées; ne pas se fier à une date de naissance saisie ou au navigateur;
- fournisseur de vérification choisi après analyse d'impact, sécurité, couverture pays, coûts et conformité; privilégier un jeton/attribut « majorité vérifiée » plutôt que conserver une copie de pièce;
- ne collecter que les attributs nécessaires; chiffrement, durée de conservation courte, accès restreint, traçabilité et suppression selon les obligations applicables;
- échec, document douteux ou contrôle indisponible => accès limité, aucune mission ni paiement; voie de recours humaine;
- contrôles de l'âge adaptés au risque et au droit local; l'interdiction des mineurs ne dispense pas d'étudier les risques de contenus accessibles publiquement.
La vérification d'identité des professionnels/entreprises et les contrôles KYC/AML sont distincts de la simple vérification de majorité.

## 6. Architecture juridique multi-pays — France, Algérie et extension internationale

Un socle commun de gouvernance est complété par un **Country Compliance Pack** versionné pour chaque pays et chaque activité. Aucun pays n'est activé par simple traduction de l'interface.

Chaque pack doit contenir:
1. entité contractante et rôle exact de PROCHÉLIA (intermédiaire, marketplace, éditeur/hébergeur, vendeur éventuel, agent éventuel);
2. conditions d'utilisation, conditions professionnelles, contrats de service, politique de remboursement et responsabilité;
3. statut des paiements, PSP disponible, monnaie, change, transferts internationaux, KYC/AML et restrictions;
4. fiscalité, facturation, TVA/taxes locales, obligations déclaratives et statut des prestataires;
5. protection des consommateurs, droit de rétractation lorsqu'applicable, garanties, pratiques commerciales et médiation;
6. données personnelles: bases légales, notices, droits, sous-traitants, transferts, hébergement, conservation, analyse d'impact et notification de violation;
7. publicité, partenariats, influence, contenus sponsorisés et transparence algorithmique;
8. propriété intellectuelle, licences des contenus, musique/vidéo, droit à l'image et retrait;
9. règles sectorielles selon les services proposés (alimentation, santé, transport, formation, travaux, etc.);
10. droit du travail et risque de requalification selon le contrôle réellement exercé sur les intervenants;
11. modération, signalements, recours, autorités compétentes et conservation des preuves;
12. avis d'un conseil juridique local qualifié et date de prochaine revue.

### France / Union européenne — contrôles à instruire
Cartographier notamment RGPD et transferts internationaux, DSA selon la fonction et la taille du service, règlement IA selon le rôle et les usages, droit de la consommation, commerce électronique, paiements/PSD2 et réglementation PSP, fiscalité/facturation, droit de la concurrence, publicité/influence, propriété intellectuelle et droit social. Applicabilité exacte à confirmer par conseil compétent; ne pas déclarer PROCHÉLIA conforme sur la seule base de cette liste.

### Algérie — contrôles à instruire
Cartographier notamment les textes applicables au commerce électronique, à la protection des consommateurs, aux pratiques commerciales, aux données personnelles et transferts, aux paiements/devises et changes, à la fiscalité/facturation, aux activités réglementées, à la publicité et à la propriété intellectuelle. Confirmer les textes en vigueur, formalités, autorisations et contraintes de transfert avec un conseil algérien et les autorités/PSP compétents avant lancement.

### Opérations transfrontalières
- Le pays de l'utilisateur, du prestataire, de l'entité contractante, du PSP et du lieu d'exécution peuvent déclencher des règles différentes.
- Bloquer un parcours si le pays, l'entité, le PSP ou le fondement juridique n'est pas validé.
- Pas de transfert de données vers un autre pays sans mécanisme juridique, information et garanties applicables.
- Pas de disponibilité de service ou de paiement annoncée dans un pays tant que le Country Pack n'est pas approuvé.

## 7. Protection de PROCHÉLIA et responsabilité

La rédaction de clauses ne supprime jamais automatiquement la responsabilité de PROCHÉLIA. Il faut aligner les contrats avec le fonctionnement réel, les rôles, le marketing et les flux financiers. Prévoir:
- cartographie des rôles et responsabilités par parcours;
- conditions et politiques compréhensibles, preuves de consentement/version;
- vérification des professionnels selon le risque et obligations locales;
- interdiction des offres illégales et catégories réglementées non autorisées;
- assurance adaptée aux activités et pays, après analyse par courtier/conseil;
- processus de réclamation, médiation, remboursement et coopération avec autorités;
- registre d'incidents, gestion des violations, conservation probatoire et plan de crise;
- contrôle des prestataires, clauses de sous-traitance, audits et plan de sortie;
- revue juridique locale avant chaque activation pays/vertical.

## 8. Confidentialité et séparation des données

- Tenant isolation vérifiée côté serveur pour clients, intervenants, entreprises et administration.
- Aucun identifiant fourni par le client ne suffit à autoriser l'accès à une ressource.
- Permissions testées sur chaque endpoint, objet, pièce jointe, conversation et opération financière.
- Données d'identité, bancaires, santé et justificatifs (si un service réglementé en exige) séparés et minimisés; pas de stockage dans localStorage.
- Chiffrement en transit et au repos, gestion de clés, rotation, accès audité, rétention et effacement.
- Environnements Preview/Staging/Production isolés; aucune donnée réelle dans les tests sans cadre validé.

## 9. Exigences de disponibilité 24/7

Définir SLO par composant, objectifs de reprise RTO/RPO, supervision externe, alertes, astreinte humaine, sauvegardes et restaurations testées, capacité, protection DDoS, gestion des files, reprise idempotente et procédures d'incident. L'IA ne peut pas remplacer l'astreinte pour les incidents critiques, les décisions juridiques ou les risques physiques/financiers.

## 10. Plan de validation et portes de lancement

### Gate 0 — conception
Cartographie des parcours, données, menaces, rôles, flux financiers et Country Packs; revue produit, sécurité et juridique.

### Gate 1 — Preview isolée
Tests automatisés unitaires/intégration/contrats; tests d'autorisation négatifs; isolation multi-tenant; vérification âge/identité simulée puis fournisseur sandbox; tests d'abus, charge, accessibilité et navigation mobile.

### Gate 2 — finance Sandbox
Parcours complet autorisation, capture, annulation, remboursement, litige, ledger, rapprochement, frais et versement sandbox; tests d'idempotence et de double paiement.

### Gate 3 — résilience et conformité
Sauvegarde chiffrée, restauration réelle sur environnement isolé, exercice d'incident, revue de conservation/effacement, test de droits, audit de sécurité indépendant, avis juridiques locaux et validation des assurances.

### Gate 4 — pilote limité
Un pays, une catégorie et un nombre limité de professionnels majeurs vérifiés; plafonds financiers; support humain; métriques et critères d'arrêt; aucune expansion automatique.

### Gate 5 — production graduelle
Autorisation écrite, PR approuvées, protections de branches, migrations revues et sauvegardées, déploiement progressif, rollback testé, surveillance renforcée. La production reste NO-GO tant que les portes ne sont pas toutes prouvées.

## 11. Critères d'acceptation obligatoires
- Tous les parcours client/intervenant/entreprise/talent testés de bout en bout.
- NEXUS TALENT intégré sans régression des services existants.
- Contrôle serveur de majorité et d'identité testé, recours inclus.
- Isolation multi-tenant et permissions démontrées par tests négatifs.
- Aucune écriture financière hors ledger autorisé; rapprochement complet.
- PSP Sandbox E2E et versements simulés concluants; délais réels documentés.
- R2/backup/restore vérifiés par preuve de restauration.
- Observabilité, alertes, runbooks, kill switch et astreinte opérationnels.
- Country Pack France validé avant pilote France; Country Pack Algérie validé avant pilote Algérie.
- Revue indépendante sécurité et avis juridique local documentés.
- Toutes les PR et déploiements ont un SHA traçable; aucune CI en échec ou non exécutée n'est réputée verte.

## 12. Limites explicites
Ce document fixe une cible produit et des contrôles à construire. Il ne prouve pas que ces fonctions sont déjà codées, testées, déployées, autorisées ou conformes. Il ne remplace pas un avis juridique, fiscal, paiement ou assurance. Toute fonction qui n'a pas de preuve vérifiable reste « non validée » et doit échouer de façon sûre.
