# PROCHÉLIA TRUST & PROTECTION FRAMEWORK — V1

**Statut :** référentiel cible soumis à revue — documentation uniquement.  
**Portée :** PROCHÉLIA SERVICES, DOMICILE, TALENT, BUSINESS, NEXUS SUPRA, tous pays et toutes interfaces.  
**Autorité exécutive :** direction PROCHÉLIA. NEXUS SUPRA prépare, surveille et orchestre uniquement dans les limites d'autorisations explicites.  
**Principe cardinal :** aucune croissance, recette, automatisation ou échéance ne justifie de compromettre la sécurité d'un client ou d'un intervenant.

> Ce document définit des exigences et des portes de contrôle. Il ne constitue pas une preuve de conformité, une certification, un avis juridique ni l'affirmation que les contrôles sont déjà implémentés.

## 1. Objectifs et résultats attendus

Le framework doit prévenir, détecter, contenir, traiter et apprendre des risques qui affectent :
- les clients, bénéficiaires et personnes vulnérables ;
- les intervenants, indépendants, salariés et partenaires ;
- PROCHÉLIA, ses dirigeants, ses actifs, ses systèmes et sa réputation ;
- les données personnelles, les paiements, les opérations et la continuité du service ;
- les tiers, sous-traitants, prestataires de paiement et partenaires locaux.

La protection doit être intégrée au cycle complet : conception, onboarding, publication d'une offre, réservation, intervention, paiement, réclamation, clôture, conservation et suppression des données.

## 2. Les dix couches de protection

### 2.1 Gouvernance juridique et responsabilité
- Maintenir pour chaque pays et chaque activité un registre des obligations, responsables, preuves, dates de revue et avis professionnels nécessaires.
- Vérifier la structure contractuelle, les rôles des parties, les conditions générales, la responsabilité, l'assurance et les règles de consommation applicables.
- Distinguer intermédiation, prestation directe, sous-traitance, emploi et autres qualifications juridiques ; ne jamais décider de ces qualifications par simple libellé produit.
- Bloquer toute activité réglementée ou conditionnée tant que les autorisations, qualifications et assurances applicables ne sont pas vérifiées.
- Conserver une décision documentée et datée pour chaque activation pays/service.

### 2.2 Cybersécurité et résilience technique
- Appliquer le moindre privilège, séparation des environnements, gestion des secrets, rotation, MFA lorsque disponible et révocation rapide.
- Protéger les sessions, API, webhooks, fichiers, sauvegardes, journaux et interfaces d'administration.
- Valider côté serveur les identités, rôles, droits, propriété des ressources, états métier et montants ; ne jamais faire confiance aux déclarations du navigateur.
- Exiger validation d'entrée, limites de taille, protection contre abus, rate limits, idempotence, gestion des courses et journalisation de sécurité.
- Maintenir inventaire des dépendances, mises à jour, scans, tests, alertes, procédure de réponse incident et plan de reprise.
- Sauvegarder de manière chiffrée et isolée ; vérifier périodiquement la restauration réelle, pas seulement l'existence d'un fichier ou la réussite d'un upload.

### 2.3 Protection des clients et bénéficiaires
- Afficher avant engagement le périmètre exact, les limites, le prix total connu, les frais, les conditions d'annulation et le canal de réclamation.
- Vérifier les intervenants selon le risque et la réglementation, sans présenter une simple auto-déclaration comme une vérification.
- Protéger les paiements, éviter toute collecte inutile de données financières et fournir des reçus et statuts fiables.
- Prévoir signalement, assistance, traitement des litiges, remboursement lorsque dû et escalade des incidents graves.
- Ne jamais promettre un résultat, une disponibilité, une qualification ou une garantie non démontrés.

### 2.4 Protection des intervenants
- Rendre lisibles les missions, exigences, rémunérations brutes, commissions, frais, délais et conditions de paiement avant acceptation.
- Ne pas facturer l'accès à une opportunité déjà gagnée ; éviter les frais opaques, pénalités disproportionnées et mécanismes de dépendance.
- Distinguer chiffre d'affaires, revenu net estimé et revenu effectivement versé ; expliciter les coûts et hypothèses.
- Permettre le signalement des abus, contestations, incidents et erreurs de profil ; prévoir un examen humain et une procédure d'appel.
- Ne pas suspendre ou déclasser automatiquement sur la base d'un signal faible non vérifié.

### 2.5 Sécurité des interventions à domicile et personnes vulnérables
- Définir une taxonomie d'activités et des niveaux de risque ; exclure par défaut les actes médicaux, de soins réglementés ou autres actes réservés sans cadre légal et professionnel vérifié.
- Contrôler qualifications, autorisations, assurance, identité et périmètre de mission selon les règles locales.
- Prévoir consentement, informations utiles minimales, contacts d'urgence, arrivée/départ, traçabilité proportionnée et procédure d'incident.
- Protéger les personnes vulnérables : évaluation préalable, limites d'intervention, prévention des abus, règles de présence/accompagnement et escalade vers les services compétents.
- Organiser continuité, remplacement et annulation sans exposer le bénéficiaire à une rupture dangereuse.
- Ne jamais transformer une alerte automatisée en jugement clinique ou décision de protection sans intervention humaine qualifiée.

### 2.6 Protection financière et intégrité des transactions
- Utiliser une source serveur unique pour prix, commissions, taxes applicables, devis, remboursements et paiements.
- Construire un ledger traçable et append-only pour les mouvements financiers ; rapprocher périodiquement les états PROCHÉLIA et PSP.
- Vérifier signature, horodatage, idempotence et transitions des webhooks ; traiter les événements répétés, tardifs et désordonnés.
- Empêcher double dépense, double payout, paiement hors mission et modification client des montants ou statuts.
- Tester échecs PSP, remboursements, litiges, chargebacks, annulations, concurrence et reprise après crash en environnement isolé.
- Garder charges, remboursements et payouts live désactivés tant que les portes financières et l'approbation requise ne sont pas toutes satisfaites.

### 2.7 Données personnelles et confidentialité
- Cartographier les données, finalités, bases légales, destinataires, transferts, durées de conservation et sous-traitants par juridiction.
- Appliquer minimisation, contrôle d'accès, chiffrement approprié, cloisonnement et journalisation des accès sensibles.
- Ne pas collecter de données sensibles sans nécessité, base légale, garanties et revue adaptées.
- Mettre en œuvre les processus de droits des personnes, rectification, export, opposition et suppression selon le droit applicable.
- Évaluer les risques et réaliser les analyses d'impact requises avant les traitements à risque élevé.
- Ne jamais utiliser les données de mission, de santé ou de vulnérabilité pour entraîner ou personnaliser un système sans base et autorisation appropriées.

### 2.8 Gouvernance de l'IA et de NEXUS SUPRA
- Distinguer explicitement faits vérifiés, déclarations utilisateur, inférences, hypothèses et inconnues ; conserver provenance, horodatage et niveau de confiance.
- Appliquer les niveaux T0 observer, T1 recommander, T2 préparer, T3 exécuter des actions préautorisées, réversibles et à faible risque, T4 approbation humaine obligatoire.
- T4 couvre notamment mouvements financiers réels, changements matériels de prix/commission, décisions juridiques ou contractuelles, activation d'un pays/service réglementé, décisions de safeguarding, restrictions de comptes, droits sur données, migrations, déploiements et engagements externes significatifs.
- Les permissions sont imposées côté serveur par une politique indépendante du modèle ; SUPRA ne peut ni s'accorder des droits, ni modifier sa politique, ni approuver sa propre action.
- Interdire l'accès direct du modèle aux secrets, commandes arbitraires de production, SQL non borné et outils de paiement non autorisés.
- Chaque action doit avoir un acteur, une autorisation, un motif, un périmètre, une limite, une clé d'idempotence si nécessaire, un résultat vérifié et une trace d'audit.
- Prévoir arrêt d'urgence, budgets, quotas, délais, limites de tentatives, mode dégradé et validation humaine.

### 2.9 Gouvernance internationale et packs pays
- Aucun pays n'est activé par traduction ou par copie des règles d'un autre pays.
- Chaque pack pays/service doit documenter entité et rôles, réglementation, fiscalité, paiements, données, assurance, sécurité, langues, support, recours et responsables locaux.
- Les règles doivent être versionnées, datées, sourcées, testées et approuvées par les responsables humains compétents.
- France et Algérie font l'objet de validations indépendantes ; aucune conclusion juridique française ne vaut validation algérienne.
- Le défaut d'information ou de preuve entraîne le statut bloqué/non activable (fail-closed).

### 2.10 Réputation, gestion de crise et continuité
- Maintenir un plan de réponse incident avec classification, responsables, délais, communication, conservation des preuves et retour à la normale.
- Définir les seuils de suspension d'une offre, d'un intervenant, d'un moyen de paiement ou d'un pays.
- Préserver les preuves utiles sans conservation excessive ni divulgation injustifiée.
- Prévoir sauvegardes, restauration, continuité des opérations, gestion des fournisseurs critiques et scénarios de crise.
- Communiquer de façon factuelle, sans minimiser, spéculer ou promettre une résolution non confirmée.

## 3. Portes de contrôle obligatoires

| Gate | Preuves minimales | Décision si preuve absente |
|---|---|---|
| G0 — Périmètre | Activité, acteurs, flux, données et risques identifiés | Refuser l'ouverture |
| G1 — Juridique pays/service | Revue locale datée, obligations, contrats, assurances et autorisations | Bloquer l'activité |
| G2 — Identité et éligibilité | Contrôles proportionnés, sources, dates, expiration et recours | Statut non vérifié, pas d'accès sensible |
| G3 — Sécurité technique | Tests auth/RBAC/ownership, abus, secrets, API, webhooks, vulnérabilités | Bloquer release |
| G4 — Données | Cartographie, finalités, accès, conservation, transferts, droits et analyses requises | Bloquer traitement |
| G5 — Finance | Sandbox PSP, ledger, rapprochement, refunds, payouts, idempotence et tests d'échec | Aucun flux live |
| G6 — Opérations et safeguarding | Procédures, support, incidents, continuité, formation et escalades | Pas de pilote concerné |
| G7 — Validation produit | Recettes client/intervenant/admin, accessibilité, mobile, langues et RTL | Pas d'ouverture publique |
| G8 — Canary contrôlé | Limites, cohortes, surveillance, seuils d'arrêt et rollback testés | Pas d'élargissement |
| G9 — Autorisation de release | Signatures des responsables, preuves consolidées et plan de retour arrière | NO-GO |

Une gate ne peut pas être déclarée satisfaite par une simple variable d'environnement, un test unitaire isolé, une capture d'écran, une déclaration du modèle ou une documentation non vérifiée.

## 4. Matrice des responsabilités

- **Direction PROCHÉLIA :** propriétaire du risque, arbitrage, approbations T4, suspension et autorisation de release.
- **Responsable technique/sécurité :** architecture, contrôle d'accès, vulnérabilités, incidents techniques, sauvegarde et restauration.
- **Responsable juridique/conformité local :** avis et validation des obligations applicables dans la juridiction.
- **Responsable opérations :** qualité, support, vérifications, continuité et traitement des incidents.
- **Responsable finance :** prix, ledger, PSP, rapprochement, remboursements et exposition financière.
- **NEXUS SUPRA :** observation autorisée, analyse, recommandations, préparation, exécution limitée et vérification ; aucune substitution aux responsables humains.
- **Partenaires et prestataires :** obligations contractuelles documentées, accès minimaux, audits et plan de sortie.

Une même personne peut porter plusieurs rôles dans une petite organisation, mais les approbations sensibles doivent conserver une séparation et une trace de contrôle adaptées.

## 5. Registre des risques et gestion des incidents

Chaque risque ou incident doit comporter au minimum :
- identifiant, date, pays, domaine et service concernés ;
- description factuelle, source et éléments de preuve ;
- personnes et actifs potentiellement affectés, sans données excessives ;
- gravité, vraisemblance, exposition et niveau de confiance ;
- mesures immédiates, responsable, échéance et statut ;
- notification ou escalade requise, selon le droit applicable ;
- décision de reprise, preuves de correction et enseignements.

Les seuils d'arrêt doivent être définis avant chaque pilote. Toute suspicion crédible de danger pour une personne, fraude financière active, compromission de compte privilégié, fuite de données importante ou perte d'intégrité des paiements déclenche une mise en sécurité et une escalade humaine immédiate. La reprise nécessite une preuve de maîtrise du risque et une décision autorisée.

## 6. Indicateurs de protection

Mesurer au minimum :
- incidents de sécurité et de safeguarding par gravité et délai de prise en charge ;
- part des intervenants dont les contrôles requis sont valides et non expirés ;
- réclamations, annulations, remboursements, litiges et récurrence ;
- écarts de rapprochement PSP/ledger et transactions non résolues ;
- accès privilégiés, secrets exposés, vulnérabilités critiques et délai de correction ;
- taux de réussite des restaurations réellement testées et temps de reprise ;
- demandes relatives aux données et respect des délais applicables ;
- actions SUPRA refusées, escaladées, annulées ou corrigées ;
- disponibilité et continuité des services essentiels.

Les seuils numériques sont définis par service et pays avant le pilote, à partir du risque réel et des obligations applicables ; aucune moyenne globale ne doit masquer un incident grave.

## 7. Conditions de suspension immédiate

Suspendre le périmètre affecté, sans attendre un objectif commercial, si :
- qualification, autorisation ou assurance requise est absente, expirée ou douteuse ;
- danger crédible pour un client, un intervenant ou une personne vulnérable ;
- fraude, falsification d'identité, détournement de paiement ou double paiement suspecté ;
- accès non autorisé, fuite de données ou compromission d'un secret ;
- impossibilité de garantir le montant, le destinataire ou l'état d'une transaction ;
- contrôles serveur, journalisation, support ou procédure d'urgence indisponibles ;
- une action automatisée dépasse son périmètre ou ne peut pas être vérifiée.

La suspension est ciblée autant que possible pour préserver les fonctions sûres, mais la sécurité prime sur la disponibilité. Toute réactivation passe par une revue documentée.

## 8. Plan d'implémentation et critères d'acceptation

### Phase A — Inventaire et cartographie
- Cartographier routes, tables, rôles, flux financiers, données, fournisseurs, environnements et workflows.
- Associer chaque exigence du framework à un contrôle existant, manquant ou non vérifié.
- Produire un registre des risques et des responsables.

**Acceptation :** couverture documentée de tous les domaines et flux critiques ; inconnues explicitement listées.

### Phase B — Contrôles techniques fondamentaux
- Auditer et tester authentification, RBAC, ownership, sessions, CSRF/CORS, validation d'entrée, rate limits, journaux et secrets.
- Vérifier idempotence, transitions atomiques, webhooks, ledger, rapprochement et gestion des erreurs.
- Vérifier sauvegarde, restauration isolée, alertes et réponse incident.

**Acceptation :** tests reproductibles sur environnement isolé, résultats conservés, défauts critiques corrigés et revue indépendante appropriée.

### Phase C — Sécurité métier et pays
- Définir les catégories de service, critères d'éligibilité, contrôles de qualification/assurance et parcours d'incident.
- Compléter les packs pays et les revues locales.
- Tester les parcours réels client et intervenant et les recours humains.

**Acceptation :** aucune activité ni juridiction ouverte sans dossier complet et approbation humaine.

### Phase D — SUPRA gouverné
- Implémenter le registre d'outils, moteur de politiques serveur, approbations, limites, audit, vérification et kill switch.
- Tester prompt injection, données falsifiées, permissions indues, répétitions, pannes et actions ambiguës.
- Garder les actions T4 hors exécution autonome.

**Acceptation :** matrice adversariale réussie, aucun contournement de permission, journaux exploitables et arrêt d'urgence testé.

### Phase E — Pilote limité
- Démarrer sur une cohorte et une zone limitées, sans activités réglementées non validées.
- Surveiller quotidiennement les indicateurs, traiter les incidents et recueillir les retours des deux côtés.
- N'élargir qu'après revue et décision écrite.

**Acceptation :** seuils prédéfinis respectés, aucun incident critique non résolu, support opérationnel et décision de poursuite signée.

## 9. État initial connu et décision de release

À la date de rédaction, les travaux documentaires de convergence et de préparation des pilotes sont en cours dans les PR #121, #122 et #123. Les éléments documentaires ne prouvent pas l'implémentation des contrôles dans le runtime.

Les contrôles suivants doivent rester considérés comme non démontrés tant que des preuves actuelles, reproductibles et rattachées à un commit/environnement ne sont pas produites : tests E2E navigateur iOS/desktop, flux PSP complets en sandbox et rapprochement, atomicité et reprise sous concurrence, restauration complète isolée, audit sécurité indépendant, conformité RGPD et revues juridiques locales, observabilité/alertes, parcours de support et validation de chaque activité.

**Décision conservatoire : NO-GO production et NO-GO paiements live** jusqu'à clôture des gates applicables et approbation humaine explicite. Aucun déploiement, migration, activation de pays ou ouverture d'activité n'est autorisé par ce document.

## 10. Règle finale

PROCHÉLIA doit protéger simultanément le client, l'intervenant et l'entreprise. La protection est une condition de conception, d'exploitation et de croissance — jamais une option ajoutée après incident.
