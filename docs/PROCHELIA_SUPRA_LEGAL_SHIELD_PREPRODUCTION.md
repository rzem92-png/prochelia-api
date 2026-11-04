# PROCHÉLIA — SUPRA Legal Shield (préproduction)

> Statut : spécification de conception en préproduction. Ce document n'est ni une certification juridique, ni un avis d'avocat, ni une autorisation de production.
> Gouvernance : aucun merge, aucune migration D1, aucun déploiement de production et aucun paiement réel sans validation explicite de la propriétaire du projet.

## 1. Objectif

Centraliser la prévention des risques juridiques, réglementaires, opérationnels et de données de PROCHÉLIA en France et dans les pays activés. SUPRA aide à rechercher, résumer, comparer, documenter, alerter et préparer des décisions. Elle ne certifie pas la conformité et ne remplace pas une autorité ou une validation humaine légalement nécessaire.

## 2. Architecture et séparation des responsabilités

1. **Source registry** : sources officielles, URI, juridiction, langue, date de consultation, date d'effet, version, empreinte du document, provenance et statut de fiabilité.
2. **Rules registry** : règles structurées et versionnées par juridiction, service, rôle et fonctionnalité; chaque règle référence ses sources.
3. **Compliance evaluator déterministe** : évalue prérequis et états; aucune décision d'autorisation ne dépend uniquement du texte généré par un LLM.
4. **SUPRA analysis layer** : résume les règles, identifie contradictions/ambiguïtés, génère checklist, questions et recommandations avec citations/provenance.
5. **Human approval workflow** : approbation explicite, identité/role de l'approbateur, version/hash de la décision, date d'effet, durée/expiration et révocation.
6. **Audit log** : append-only, accès restreint, minimisation, horodatage serveur et traçabilité des modifications.
7. **Feature gate** : activation par pays, service, flux financier et fonction; blocage prudent si source/règle est manquante, expirée, contradictoire ou non validée.

Le modèle IA ne peut pas s'octroyer de permissions, modifier les règles autoritatives, approuver sa propre recommandation, activer un pays, exécuter un remboursement, suspendre un utilisateur, conclure un litige ou modifier un contrat sans processus humain/serveur autorisé.

## 3. États de juridiction

- **RESEARCH_ONLY** : collecte d'information; aucune prestation réelle.
- **PREPRODUCTION** : tests fictifs/sandbox seulement.
- **REVIEW_REQUIRED** : source/règle incertaine, changement ou contrôle en attente.
- **READY_FOR_HUMAN_APPROVAL** : dossier préparé, décision humaine requise.
- **ACTIVE** : activation limitée au périmètre approuvé, version de règles fixée.
- **SUSPENDED** : désactivation prudente si obligation critique, source ou contrôle est devenu incertain.

Aucun pays ne passe automatiquement à ACTIVE. Les statuts ne sont pas des déclarations de conformité officielle.

## 4. Domaines de conformité à couvrir

### Société, plateforme et relation intervenant
- Qualification exacte de l'activité : mise en relation, intermédiaire, opérateur de plateforme, prestataire ou autre rôle selon le flux réel.
- Risque de requalification du statut indépendant; autonomie réelle, contrôle, prix, sanctions, organisation, remplacement et conditions d'exécution.
- Obligations plateforme, transparence, classement, commission, identité des prestataires, informations fiscales/sociales et obligations déclaratives applicables.
- DAC7/DPI : déterminer le champ d'application, la diligence, la collecte d'informations, les communications et déclarations à effectuer.
- Régime social des plateformes et évolutions françaises : suivi des échéances et analyse du champ d'application; ne pas coder une obligation de prélèvement sans vérification officielle/versionnée.

### Services à la personne, activités réglementées et personnes vulnérables
- Distinguer aide quotidienne, accompagnement, ménage, livraison/transport, garde, soins et toute activité réglementée.
- Vérifier déclaration/agrément/autorisation, qualification, assurances, conditions d'accès et limites des prestations.
- Empêcher l'affichage/réservation d'une prestation réglementée ou non autorisée dans une juridiction.
- Procédures sécurité et protection des personnes vulnérables, incidents, urgence et escalade humaine.

### Clients et consommateurs
- Informations précontractuelles, prix total, frais/commissions, annulation, rétractation si applicable, exécution, réclamation, médiation et remboursement.
- CGU/CGV et contrat adapté au rôle réel des parties; version acceptée et preuve de présentation.
- Pas de clauses trompeuses, d'exonération générale illégale ou de consentement présumé.

### Données personnelles, RGPD et GPS
- Cartographie des rôles (responsable/sous-traitant/responsables conjoints selon faits), finalités, bases légales, catégories, destinataires et transferts.
- Registre, information, droits, minimisation, sécurité, conservation/purge, sous-traitants, gestion de violation, privacy by design/by default.
- Évaluer la nécessité d'une AIPD/DPIA au cas par cas et documenter le résultat.
- GPS : mission limitée, transparence, activation explicite et indicateur visible, pas de suivi hors mission, points ponctuels par défaut, alternative QR/PIN, pas de décision défavorable basée uniquement sur GPS.
- Photos et documents : ne collecter que ce qui est nécessaire; éviter images de personnes, domicile ou données sensibles non nécessaires.
- IP pseudonymisée, GPS et identifiants de mission peuvent rester des données personnelles; ne pas qualifier de données anonymes sans démonstration.

### Paiements, comptabilité et fiscalité
- PSP et rôles de paiement validés; PROCHÉLIA ne stocke pas de données carte complètes.
- Ledger transactionnel, idempotence, rapprochement, frais, remboursements, chargebacks, disputes et audit.
- Facturation et e-invoicing/e-reporting : vérifier le calendrier applicable et utiliser une plateforme agréée ou solution compatible appropriée; ne pas présenter PROCHÉLIA comme plateforme agréée sans immatriculation.
- TVA, seuils, commissions, revenus, taxes et obligations par pays; validation des règles fiscales versionnées.
- Pas de paiements réels en préproduction.

### Sécurité, responsabilité et assurance
- Contrôles d'identité et documents proportionnés; statut, portée, expiration et révocation.
- Assurance de la plateforme et des intervenants, exclusions, couverture géographique et activité exacte.
- Gestion incidents, réclamations, sécurité client/intervenant, fraude, abus, signalement et procédure d'urgence.
- Limites contractuelles réalistes; pas de promesse de sécurité absolue ou d'absence de responsabilité.

### IA, automatisation et transparence
- Inventaire des usages IA, données utilisées, risques, transparence, supervision, logs et limites.
- Evaluation de l'applicabilité AI Act et des autres règles par usage et pays; dates d'application à versionner depuis les sources officielles.
- Prompt injection, données malveillantes, sources trompeuses, citations fabriquées, fuite cross-tenant et décisions automatisées.
- SUPRA n'exécute pas seule les décisions à impact juridique, financier, contractuel, sécurité, suspension, droits RGPD ou litige.

## 5. Flux de mission, preuves et litiges

- Mission avec identifiant unique, périmètre, lieu, heure, prix, règles de preuve et consentements/informations.
- Début/fin : QR dynamique/PIN, confirmation bilatérale, horodatage serveur et GPS ponctuel facultatif.
- Journal append-only; correction par nouvel événement, jamais par effacement silencieux.
- Reçu partagé aux parties, versionné, avec preuve d'intégrité et données minimisées.
- SUPRA sépare faits vérifiés, déclarations, preuves et incertitudes; recueille les versions contradictoires et propose options.
- Recours humain et contestation; pas de fraude, suspension ou remboursement décidé uniquement par IA.
- Exceptions : client absent, intervenant absent, retard, annulation, prestation partielle, refus de signature, panne, hors réseau, QR/PIN rejoué, GPS falsifié, conflit tarifaire, incident, discrimination, harcèlement, paiement double, chargeback, traduction erronée et mission internationale.

## 6. Internationalisation

- Dossier par pays/région, service et rôle, jamais une règle universelle.
- Sources officielles locales, langues, dates et fuseaux IANA, formats, monnaie, TVA, paiements, contrats, preuve/signature, protection des données, transferts, statut prestataire, services réglementés, assurance, consommateur et fiscalité.
- Traduction IA non authoritative; conserver texte original et version validée.
- Pays en RESEARCH_ONLY/PREPRODUCTION tant que les contrôles critiques ne sont pas satisfaits.
- Changement réglementaire : alerte, analyse d'impact, version proposée, approbation humaine, test et activation planifiée; rollback possible.
- VPN, langue ou IP ne déterminent jamais seuls la juridiction; collecter le minimum nécessaire et vérifier le contexte.

## 7. Gouvernance et sécurité

- RBAC et séparation client/intervenant/admin; tenant isolation testée.
- Approbation liée à la version/hash exacte, non réutilisable, expirante et révocable.
- Gestion des secrets, chiffrement en transit/au repos, rotation, sauvegarde, restauration testée, alertes et réponse incident.
- Rétention configurée par catégorie/juridiction; purge et anonymisation vérifiables.
- Audit de dépendances, vulnérabilités, CI, tests de non-régression et rollback.
- Accessibilité, langue claire, assistance, alternatives pour faible connectivité et personnes en situation de handicap.
- Plan de continuité, reprise après sinistre, indisponibilité PSP/GPS/Cloudflare, crise économique ou réseau.
- Gouvernance des changements et approbation humaine des politiques sensibles.

## 8. Sources officielles et actualisation

Le registre doit privilégier les sources primaires : textes consolidés, journaux officiels, autorités fiscales/sociales, autorités de protection des données, régulateurs de paiement et autorités sectorielles. Chaque synthèse doit inclure source, date, version et extrait/référence vérifiable.

La veille peut déclencher une alerte et une analyse de changement, mais aucune mise à jour de règle ou de code n'est automatiquement déployée.

## 9. Tests minimums avant activation

- Juridiction inconnue/non autorisée; règle absente, expirée, conflictuelle ou non approuvée.
- Mauvaise version de CGU, consentement/information non présenté, retrait/refus GPS.
- Accès cross-tenant, rôle erroné, approbation expirée/rejouée, appel API direct.
- Suppression/export/rectification, rétention dépassée, incident et restauration.
- Source juridique inexistante, citation hallucinée, prompt injection, document falsifié, contradiction et traduction.
- DAC7 et collecte d'identifiants : complétude, correction, minimisation, accès et exports.
- Facture, e-reporting, commission, TVA et intégration PA/solution compatible en sandbox.
- Paiement/webhook idempotent, ordre des événements, concurrence, remboursement et rapprochement.
- Preuves de mission : replay QR/PIN, GPS incohérent, offline, fuseau, client absent, conflit et contestation.
- Tests de sécurité, accessibilité, performance, disponibilité et reprise.

## 10. Gates de lancement

Le pays/service ne peut être proposé en réel que si :
- scope métier/juridique identifié;
- sources officielles et règles versionnées;
- contrôles techniques et tests requis réussis;
- données, contrats, assurance et paiements documentés;
- incidents/recours/support et rétention définis;
- validation humaine enregistrée;
- propriétaire du projet autorise explicitement le lancement.

**NO-GO** si : source critique absente, obligation non résolue, test sécurité critique échoué, statut intervenant incertain, activité réglementée non autorisée, PSP/facturation non validés, sauvegarde/restauration non testée ou consentement/information essentielle manquante.

## 11. Points France à vérifier avant production

- DAC7/DPI et qualification d'opérateur de plateforme.
- Régime social des plateformes et calendrier 2026/2027.
- Réforme de facturation électronique et recours à une plateforme agréée/solution compatible.
- SAP, déclaration/agrément et limites des activités auprès de personnes vulnérables.
- RGPD, GPS et nécessité éventuelle d'une AIPD.
- DSA, transparence et mécanismes de réclamation selon le champ d'application.
- AI Act et obligations applicables à chaque usage de SUPRA.

Ces points sont des sujets de vérification et non une conclusion que chaque obligation s'applique nécessairement à PROCHÉLIA.

## 12. Statut de livraison

Ce document formalise les exigences. Il ne prouve pas que les contrôles sont déjà codés ou testés. Les migrations D1, merges, déploiements, activation de pays et paiements réels restent interdits sans validation explicite.