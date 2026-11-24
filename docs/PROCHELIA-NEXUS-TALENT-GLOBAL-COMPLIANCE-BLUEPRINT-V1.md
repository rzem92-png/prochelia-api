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

## 5. Protection des mineurs et parcours « Jeunes Talents » protégés

PROCHÉLIA doit pouvoir accueillir un parcours Jeunes Talents distinct du marché professionnel adulte, mais uniquement dans les pays et catégories où une analyse juridique locale a confirmé les conditions de participation. Ce parcours n'est jamais activé par défaut. Il ne donne pas automatiquement accès aux missions de services, au travail indépendant, aux contrats professionnels, aux lives publics ni aux paiements.

- Parcours séparé par tranche d'âge et pays, avec âge vérifié par un prestataire proportionné; ne pas se fier à une date de naissance déclarée. Conserver un jeton/attribut d'âge plutôt que la copie d'une pièce lorsque possible.
- Consentement et implication du titulaire de l'autorité parentale lorsque le droit l'exige; vérification proportionnée du lien et procédure de retrait. Ne pas demander plus de données familiales que nécessaire.
- Profil privé par défaut, pseudonyme public, aucune adresse/école/localisation précise, aucune géolocalisation en direct, aucune indexation externe par défaut et aucune publicité comportementale ciblée.
- Messagerie privée adulte-mineur désactivée par défaut; aucun contact privé non sollicité, aucun partage de coordonnées, aucune rencontre hors plateforme sans procédure et encadrement légal spécifiques.
- Commentaires, lives, cadeaux, contenus sponsorisés et interactions soumis à des restrictions adaptées à l'âge; modération renforcée, filtres de contact, blocage immédiat et signalement accessible.
- Pas de mécanismes de pression, de classement humiliant, de récompenses aléatoires payantes, de compte à rebours manipulatoire ni de sollicitation financière directe.
- Aucun versement direct à un mineur par défaut. Toute rémunération éventuelle doit être désactivée jusqu'à validation écrite du droit local, du statut, des règles de travail des enfants, de la fiscalité, des contrats, du PSP et du rôle du représentant légal. Si un modèle autorisé existe, le bénéficiaire, le compte de paiement et les justificatifs doivent être définis conformément au droit applicable; l'accord parental seul ne suffit pas à rendre une activité licite.
- Les adultes et les mineurs ne partagent pas les mêmes règles d'accès, de découverte, de recommandation, de monétisation et de contact. Les décisions d'éligibilité ou de sanction sont explicables et contestables.
- Si l'âge est incertain, si le contrôle échoue ou si le pays n'est pas validé, le compte reste en mode restreint sans publication publique, contact ni monétisation. Prévoir recours humain.
- Les signalements de mise en danger, grooming, exploitation, sextorsion ou contenu sexuel impliquant un mineur suivent une procédure urgente dédiée, avec conservation minimale et sécurisée des éléments, escalade vers les personnes compétentes et signalement aux autorités lorsque requis. Ne jamais demander à l'utilisateur de renvoyer ou télécharger un contenu sexuel impliquant un mineur.

La vérification d'âge, l'identité, le statut professionnel, les qualifications et le KYC/AML sont des contrôles distincts. Aucun mineur n'est utilisé comme main-d'œuvre sur le marché des missions tant que le cadre légal applicable n'a pas été qualifié et autorisé.

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


## 12. Architecture transverse — les dix piliers Nexus complémentaires

Cette section complète les domaines existants sans créer dix applications ni dupliquer les fonctions déjà présentes. Chaque capacité réutilise l'identité, les permissions, les événements, le support, le référentiel pays, les journaux et les services communs existants. Avant toute implémentation, vérifier les routes, tables, composants et règles déjà présents.

### 12.1 NEXUS SENTINEL — anticipation et prévention
- Corréler les signaux de sécurité, fraude, disponibilité, qualité et abus sans transformer une simple corrélation en accusation.
- Détecter les scénarios de comptes coordonnés, faux avis, usurpation, tentatives de prise de compte, anomalies de réservation et paiements atypiques.
- Attribuer un niveau de confiance, une gravité, une durée de validité et les éléments justificatifs à chaque alerte.
- Autoriser uniquement des mesures temporaires, réversibles et préapprouvées; revue humaine rapide pour les impacts élevés.
- Mesurer les faux positifs et permettre contestation et correction.

### 12.2 NEXUS CARE — assistance et résolution
- Un dossier unique suit demande, réclamation, médiation, pièces utiles, responsable, échéance et résolution.
- Classer les urgences et acheminer vers une personne compétente; le support automatisé ne prétend pas remplacer les secours ou les professionnels.
- Accuser réception, informer sur les étapes et délais réels, conserver une piste d'audit et proposer un recours.
- Protéger les personnes vulnérables et limiter l'accès aux données strictement nécessaires.

### 12.3 NEXUS QUALITY — qualité vérifiable
- Relier les évaluations aux prestations réellement terminées et aux utilisateurs authentifiés.
- Séparer faits observables, avis subjectifs, contestations et décisions de modération.
- Suivre ponctualité, conformité au devis, récurrence des incidents, satisfaction et résolution.
- Détecter les faux avis et représailles; permettre réponse, correction et appel.
- Ne jamais faire d'une note isolée ou d'un signal non vérifié un motif automatique de bannissement.

### 12.4 NEXUS FAIR OPPORTUNITY — accès équitable aux opportunités
- Recommander missions, formations et collaborations selon compétences, disponibilité, zone, langue et critères annoncés.
- Donner une exposition mesurée aux nouveaux profils qualifiés; surveiller concentration et biais des recommandations.
- Expliquer les critères principaux et offrir des contrôles de préférences.
- Ne pas vendre un meilleur classement de confiance; distinguer publicité sponsorisée et pertinence organique.
- Auditer périodiquement les écarts de distribution et les résultats.

### 12.5 NEXUS INTELLIGENCE — parcours personnalisés
- Proposer une navigation adaptée aux objectifs déclarés: trouver un service, exercer, apprendre, créer, collaborer ou développer une activité.
- Permettre à un même compte d'avoir plusieurs rôles, avec permissions séparées et bascule explicite.
- Recommander des actions utiles plutôt que maximiser le temps passé ou les notifications.
- Donner accès aux réglages de personnalisation, à la désactivation des recommandations et à une recherche non personnalisée.
- Ne pas inférer de catégories sensibles pour profiler ou tarifer les personnes.

### 12.6 NEXUS ACCESSIBILITY — accessibilité et inclusion
- Concevoir mobile-first, navigation clavier, focus visible, contrastes suffisants, libellés accessibles et compatibilité lecteurs d'écran.
- Prévoir zoom, textes clairs, messages d'erreur compréhensibles, sous-titres/transcriptions et réduction des animations.
- Tester avec des outils automatisés et des personnes ayant des besoins divers; documenter les écarts et corrections.
- Proposer plusieurs langues sans altérer les conditions contractuelles ni les montants.
- Cible d'ingénierie: WCAG 2.2 AA, à vérifier par audit et tests réels; ne pas déclarer la conformité sans preuve.

### 12.7 NEXUS GLOBAL — expansion contrôlée
- Le Country Compliance Pack est l'autorité serveur pour l'activation d'un pays, d'un métier, d'un paiement et d'une fonctionnalité.
- Chaque lancement exige responsable local, analyse juridique/fiscale/paiement/données, support linguistique, assurance et capacité opérationnelle.
- Déployer d'abord en environnement isolé, puis pilote limité avec critères d'arrêt et retour arrière.
- Bloquer par défaut les activités, flux financiers et transferts de données non validés.
- Mesurer qualité, incidents, rentabilité, délais de support et satisfaction avant extension.

### 12.8 NEXUS BUSINESS INTELLIGENCE — intelligence économique
- Consolider des indicateurs traçables: demande, offre disponible, conversion, rétention, coût d'acquisition, marge contributive, revenus intervenants, remboursements et fraude.
- Comparer scénarios de prix et commissions avant proposition; afficher hypothèses, intervalles d'incertitude et impacts sur clients, intervenants et plateforme.
- Distinguer données réelles, estimations, hypothèses et prévisions.
- Ne jamais inventer de KPI lorsque les données sources sont absentes ou non fiables.
- Soumettre les changements de commission, tarification réglementée et décisions à fort impact à validation humaine.

### 12.9 NEXUS DATA VAULT — gouvernance des données
- Inventorier données, finalités, bases légales, catégories, destinataires, transferts, durées et responsables.
- Appliquer minimisation, chiffrement, séparation des tenants, contrôle d'accès, rotation des clés et journalisation.
- Fournir les parcours d'accès, rectification, export, opposition et suppression lorsque le droit le prévoit, avec gestion des obligations de conservation.
- Séparer données d'identité, vérification d'âge, qualification professionnelle, KYC/AML et données de paiement.
- Tester restauration, suppression effective, sauvegardes et gestion des incidents; aucune promesse d'effacement d'une sauvegarde avant vérification technique et légale.

### 12.10 NEXUS EVOLUTION — amélioration continue contrôlée
- Collecter les retours, incidents, métriques et demandes de fonctionnalités avec consentement et minimisation adaptés.
- Détecter doublons et régressions avant de proposer une nouvelle brique.
- Produire une fiche de changement: problème, utilisateurs concernés, valeur attendue, risques, dépendances, coût, critères d'acceptation et plan de retour arrière.
- Développer dans une branche isolée, tests automatisés, revue de sécurité, Preview et validation humaine.
- Aucun déploiement Production, migration destructive, modification financière ou changement de politique critique par autonomie non approuvée.

## 13. NEXUS CYBER SHIELD et NEXUS PROTECT — sécurité unifiée

Les capacités anti-piratage, anti-escroquerie, anti-usurpation, anti-harcèlement et protection des personnes forment une défense en profondeur, réutilisant les contrôles de sécurité existants:
- MFA/passkeys pour comptes sensibles; protection contre credential stuffing, phishing, réinitialisation abusive et détournement de session.
- Autorisation serveur à chaque ressource et opération; isolation tenant testée contre accès croisés; limitation de débit, validation stricte des entrées et protection API.
- WAF/DDoS, CSP et en-têtes sûrs, protections XSS/CSRF/SSRF/SQLi, analyse des dépendances, secrets hors dépôt, SBOM et CI protégée.
- Détection de profils fictifs, faux justificatifs, usurpation, faux avis, escroqueries, paiements anormaux, liens malveillants et demandes de sortie de plateforme à risque.
- Outils de signalement, blocage, preuve horodatée, suivi du dossier, notification, modération et recours.
- Restrictions temporaires proportionnées pour contenir un danger; bannissement définitif, accusation publique, transfert de fonds ou décision juridique réservés à une procédure habilitée.
- Exercices d'incident, tests d'intrusion autorisés, restauration, rotation de secrets, revue des accès et post-mortems.

Aucun système n'est inviolable. Les objectifs mesurables sont réduction du risque, détection rapide, confinement, restauration vérifiée et transparence des incidents.

## 14. Parcours unifié et promesse de valeur

Le produit doit organiser une boucle utile, sans devenir un flux social conçu pour maximiser artificiellement l'attention:

**Découvrir → Apprendre → Créer → Collaborer → Travailler → Gagner → Évoluer.**

Chaque écran doit conduire à une action utile et compréhensible:
- Client: trouver, comparer, réserver, suivre, payer via PSP autorisé, évaluer et demander assistance.
- Intervenant: créer un profil, prouver ses compétences, choisir ses disponibilités, recevoir des opportunités, répondre, réaliser, facturer et suivre ses revenus.
- Créateur: publier, gérer droits et audience, proposer une offre, réserver ou vendre si autorisé, suivre les revenus nets et exporter ses données.
- Apprenant: identifier un objectif, suivre un parcours, mesurer ses progrès et accéder à des opportunités adaptées.
- Entreprise: vérifier son organisation, publier des besoins, sélectionner des compétences, contractualiser et suivre les résultats.
- Administrateur/support: traiter les dossiers avec séparation des rôles, journalisation, priorités et délais.

La navigation doit être cohérente sur mobile et ordinateur, accessible, multilingue et explicable. Les fonctionnalités non disponibles dans un pays ou pour un rôle ne doivent pas être présentées comme actives.

## 15. Indicateurs de pilotage et critères d'acceptation

Les tableaux de bord doivent afficher la source, la période, la définition et la fraîcheur de chaque indicateur. Cibles à fixer après mesure initiale:
- sécurité: tentatives bloquées, comptes compromis confirmés, faux positifs, délai de détection et de confinement, vulnérabilités ouvertes par ancienneté;
- confiance: délai de traitement des signalements, taux de résolution, recours acceptés, faux avis confirmés;
- qualité: missions terminées, annulations, litiges, ponctualité et satisfaction vérifiée;
- équité: distribution des opportunités, exposition des nouveaux profils, concentration des revenus et écarts inexpliqués;
- économie: marge contributive, frais PSP, remboursements, revenus nets intervenants, coûts de support et trésorerie réellement rapprochée;
- fiabilité: disponibilité mesurée, latence, erreurs, RPO/RTO observés, succès des restaurations et résultats des exercices;
- accessibilité: défauts WCAG ouverts, parcours clavier et lecteur d'écran testés;
- produit: activation utile, accomplissement des parcours, rétention volontaire et satisfaction, sans optimiser le temps d'écran comme objectif isolé.

Aucun KPI ne doit être simulé ou présenté comme réel. Les seuils et objectifs sont versionnés, approuvés et adaptés au pilote.

## 16. Plan de construction sans doublons

1. Cartographier le code, les routes, tables, composants et PR existants; dresser une matrice capacité → implémentation → tests → preuve.
2. Stabiliser l'identité, rôles, isolation tenant, sessions, journal d'audit et permissions SUPRA.
3. Achever les parcours marketplace et l'espace intervenant connecté; valider les parcours clients et entreprises.
4. Valider signalement, modération, recours, anti-fraude, anti-piratage et support.
5. Valider ledger, PSP Sandbox E2E, remboursements, rapprochement et revenus intervenants.
6. Livrer les expériences Talent, apprentissage et collaboration seulement après droits, modération, paiements et conformité pays.
7. Réaliser audits accessibilité, sécurité, charge, sauvegarde/restauration et conformité.
8. Pilote limité France après validation écrite; Algérie et autres pays restent désactivés jusqu'à validation locale complète.
9. GO Production uniquement après preuve de chaque gate, revue humaine et autorisation explicite.

## 17. Statut de réalisation et règle de vérité

Ce blueprint est une cible produit. Une fonctionnalité n'est considérée « construite » que si le code est présent, relié aux routes et données réelles, protégé par les permissions, testé en CI et validé sur un parcours Preview représentatif. Une fonctionnalité n'est « opérationnelle » qu'après preuve d'exploitation et de supervision. Une fonctionnalité n'est « autorisée dans un pays » qu'après validation réglementaire et opérationnelle locale.

Les PR existantes restent séparées et non fusionnées jusqu'à résolution des dépendances et des tests. Aucun déploiement Production, migration distante, paiement réel ou activation de pays n'est autorisé par ce document.


## 14. NEXUS SHIELD — confiance, anti-harcèlement, anti-escroquerie, anti-piratage et cybersécurité

NEXUS SHIELD est le dispositif transversal de confiance et de sécurité, coordonné par NEXUS SUPRA. Il couvre les comptes, profils, messages, contenus, lives, réservations, missions, paiements, entreprises, intervenants et espaces Jeunes Talents. Il s'appuie sur les contrôles serveur et des opérateurs humains; une IA ou un score de risque n'est jamais une preuve définitive.

### Prévention et détection
- Défense des comptes: passkeys/MFA pour les rôles sensibles, limitation des tentatives, détection du credential stuffing, protection contre phishing, sessions révocables, alertes de connexion inhabituelle et récupération de compte renforcée.
- Défense applicative: validation serveur, moindre privilège, isolation des tenants, protection XSS/CSRF/SSRF/injection, contrôle des fichiers, secrets hors code, chiffrement, rotation, sauvegardes restaurables, surveillance des API et protections anti-bot/DDoS adaptées.
- Anti-escroquerie: détection des faux profils, usurpations, documents incohérents, faux avis, faux abonnés, demandes de paiement hors plateforme, fausses preuves de mission, fraude au remboursement, manipulation des commissions et abus de promotions.
- Anti-harcèlement: détection du harcèlement répété, menaces, chantage, discrimination, doxxing, stalking, spam, raids coordonnés et sollicitations sexuelles non désirées; outils bloquer, masquer, limiter, filtrer et signaler.
- Anti-piratage et droits: procédure de signalement de contenus contrefaisants, preuve de titularité ou mandat, retrait/suspension selon procédure, contre-notification lorsque requise, gestion des récidivistes et traçabilité. Aucun retrait automatique irréversible sur une simple détection de similarité.
- Protection des mineurs: contrôles renforcés, prévention du grooming, séparation des espaces et contacts, modération prioritaire et escalade urgente.

### Réponse graduée et équitable
1. Un signal ou score déclenche une analyse; il ne suffit pas à conclure à une fraude ou à bannir.
2. En cas de risque immédiat, SUPRA peut appliquer une mesure temporaire, proportionnée et réversible préautorisée: masquer un contenu, couper un contact, ralentir une action, bloquer temporairement un paiement suspect via le PSP ou geler une session compromise.
3. L'utilisateur reçoit une information adaptée, un motif compréhensible, la durée ou le statut de la mesure et un canal de contestation, sauf exception légale de confidentialité.
4. Les sanctions durables, fermetures définitives, confiscations, accusations publiques et décisions contestées exigent une revue humaine habilitée et une preuve suffisante.
5. Les signalements urgents liés à une menace physique ou à un mineur sont priorisés et escaladés selon une procédure documentée.
6. Prévoir contrôle des faux positifs, protection contre les signalements malveillants et recours accessible aux personnes visées.

### Gouvernance SUPRA et preuves
Chaque décision enregistre: identifiant d'événement, tenant, compte/ressource concerné, source du signal, faits observés séparés des hypothèses, règle et version, niveau de confiance, mesure, durée, acteur automatique/humain, approbation, notification, résultat et recours. Accès aux preuves limité, conservation définie, intégrité protégée et suppression à échéance. Les données sensibles ne sont pas utilisées pour inférer un diagnostic ou profiler la vulnérabilité psychologique d'une personne.

### Conditions de mise en service
Avant activation: tests adversariaux, scénarios de faux positifs, abus coordonnés, récupération de compte, compromission d'administrateur, fraude au paiement, signalement/retrait/recours, protection mineurs, tests d'isolation multi-tenant, plan d'incident, astreinte et audit indépendant. Sans preuve d'exécution, la fonction est marquée « spécifiée, non vérifiée » et ne doit pas être présentée comme opérationnelle.
