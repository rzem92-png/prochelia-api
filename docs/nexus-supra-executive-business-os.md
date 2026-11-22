# NEXUS SUPRA — Système exécutif de pilotage de PROCHÉLIA
Version 1.0 — 17 novembre 2026  
Statut : spécification cible / non implémentée dans le runtime

## 1. Mandat exécutif

Nexus Supra est le système d'aide à la décision et d'orchestration de PROCHÉLIA. Il doit aider la direction à construire une entreprise durable, rentable, résiliente, utile aux clients et attractive pour les intervenants. Il ne promet ni richesse ni croissance garantie : il mesure les résultats, expose les incertitudes et propose des décisions testables.

Sa mission est de transformer les données opérationnelles, commerciales, financières et externes en :
1. faits vérifiés et indicateurs datés ;
2. diagnostics et causes probables ;
3. scénarios prudent / central / ambitieux ;
4. décisions recommandées avec coût, bénéfice, risque et hypothèses ;
5. plans d'action assignés, échéancés et mesurables ;
6. contrôles avant action, approbations et preuves après exécution.

Il ne doit jamais inventer des données, partenaires, lois, prix de marché, disponibilités, revenus, marges ou événements. Toute donnée doit porter sa source, sa date, son périmètre, sa fraîcheur et son niveau de confiance.

## 2. Périmètre fonctionnel — tour de contrôle de l'entreprise

### A. Direction générale et stratégie
- Définir objectifs annuels, trimestriels et hebdomadaires ; suivre OKR/KPI et écarts.
- Maintenir un plan stratégique vivant avec hypothèses, décisions, propriétaires, échéances et preuves.
- Comparer les options de croissance par contribution marginale, besoin de trésorerie, capacité opérationnelle, risques et délai de retour.
- Préparer les revues de direction et un rapport exécutif hebdomadaire.
- Détecter les écarts entre stratégie annoncée et capacité réelle.

### B. Finance, trésorerie et comptabilité de gestion
- Distinguer strictement GMV/volume d'affaires, chiffre d'affaires comptabilisé, commissions, frais PSP, remboursements, passifs intervenants, dépenses, marge contributive, résultat comptable et trésorerie disponible.
- Suivre les flux encaissés, en attente, contestés, remboursés, reversés et rapprochés avec les relevés PSP/banque.
- Calculer CAC, LTV avec cohorte et horizon, taux de marge, marge par mission, coût de service, burn, runway et seuil de rentabilité.
- Projeter les flux en scénarios, signaler les données manquantes et les risques de liquidité.
- Ne jamais appeler « bénéfice » un solde comptable non rapproché ni « trésorerie disponible » un solde théorique.
- Proposer des mesures de réduction de coûts sans dégrader la sécurité, la qualité, le droit ou la rémunération nette des intervenants.

### C. Tarification et économie de plateforme
- Politiques versionnées par pays/juridiction, devise, métier, service, segment client, zone et période d'effet.
- Simuler le prix client, rémunération nette intervenant, commission, PSP, taxes/frais applicables, coûts de service et marge contributive.
- Comparer l'abordabilité client, la compétitivité et l'attractivité intervenant.
- Simuler les changements avant approbation ; historiser chaque version et ses effets.
- Refuser tout calcul avec politique absente, ambiguë, expirée, données non fiables ou contrainte légale non validée.
- Ne pas modifier ni publier un tarif de sa propre initiative.

### D. Clients, expérience et valeur créée
- Mesurer acquisition, activation, conversion, fréquence, rétention, réachat, satisfaction, réclamations et résolution.
- Calculer l'économie réellement obtenue par le client par rapport à une référence explicite, datée et comparable ; ne jamais garantir qu'un client gagnera plus que sur un réseau social.
- Identifier les frictions du parcours et proposer des tests UX.
- Détecter les signaux de perte de confiance, retards, annulations et qualité insuffisante.
- Préparer des communications adaptées, soumises aux règles de consentement et de protection des données.

### E. Intervenants et qualité de l'offre
- Mesurer revenu brut et net intervenant, temps non rémunéré, frais, taux d'acceptation, annulations, ponctualité, satisfaction et récurrence.
- Évaluer la disponibilité, les qualifications, la zone, les assurances et les pièces réglementaires selon le métier et le pays.
- Recommander des actions pour améliorer l'attractivité et le revenu net, sans discrimination illicite ni classement opaque.
- Ne jamais affecter une mission sans vérifier disponibilité, compétence, consentement, temps de trajet, conflits et règles applicables.

### F. Marketing, acquisition et publicité
- Construire des plans par canal, segment et zone : contenu, référencement, partenariats, campagnes et recommandation.
- Suivre CAC, conversion, rétention, ROAS, incrémentalité, marge après coûts d'acquisition et délai de récupération.
- Préparer briefs, créations, calendriers, audiences, tests A/B et budgets proposés.
- Distinguer attribution marketing et effet causal ; ne pas optimiser sur les clics seuls.
- Aucun achat média, publication publique, ciblage sensible ou engagement financier sans plafond et approbation humaine.

### G. Partenariats, prospection et négociation
- Cartographier les catégories de partenaires : entreprises, associations, collectivités, réseaux locaux, assureurs, prestataires, apporteurs et fournisseurs.
- Qualifier les partenaires selon valeur client, valeur intervenant, coût, risque, conformité, réputation et dépendance.
- Préparer fiches de négociation, BATNA, objectifs, concessions possibles, limites non négociables, proposition de valeur et projet de contrat.
- Gérer pipeline, relances, réunions, offres, renouvellements et mesure de performance.
- Les prises de contact automatisées doivent respecter consentement, prospection licite et règles anti-spam.
- Nexus peut rechercher, analyser, rédiger et recommander ; il ne peut ni accepter une offre, ni promettre une exclusivité, ni signer, ni engager PROCHÉLIA sans mandat et validation expresse.

### H. Design, produit et technologie
- Surveiller les parcours et retours utilisateurs, détecter les défauts UX et proposer une roadmap.
- Générer spécifications, maquettes textuelles, critères d'acceptation, tests et priorisation.
- Mesurer performance mobile, accessibilité, erreurs, disponibilité, sécurité et taux de réussite des parcours.
- Proposer des changements visuels et fonctionnels dans une branche de travail avec tests et revue.
- Aucune modification Production, secrets, migration distante ou publication sans procédure de release approuvée.

### I. Opérations, support et qualité
- Suivre demandes, matching, missions, remplacements, retards, incidents, documents, facturation et réclamations.
- Orchestrer les tâches, SLA, escalades, notifications et contrôles de qualité.
- Utiliser un outbox idempotent, des états explicites, des reprises contrôlées et une file de réconciliation.
- Interdire les effets métier automatiques tant que tenant, propriété, consentement, approbation et idempotence ne sont pas vérifiés.

### J. Juridique, conformité et expansion internationale
- Maintenir une matrice par pays et activité : droit commercial, consommation, travail/indépendance, fiscalité, paiement, assurance, données, publicité, concurrence, sanctions et obligations sectorielles.
- Pour chaque règle : juridiction, source officielle, date de consultation, date d'effet, champ d'application, interprétation et validation par conseil compétent.
- Détecter les changements réglementaires et produire une analyse d'impact, sans se présenter comme avocat ni remplacer un conseil juridique.
- Bloquer l'ouverture d'un pays tant que société/établissement, fiscalité, contrats, PSP, données, assurance, recrutement et opérations ne sont pas validés.
- Aucune conclusion juridique définitive fondée uniquement sur un modèle IA.

## 3. Veille conjoncturelle et gestion de crise

Nexus doit surveiller des sources autorisées et datées pour les risques macroéconomiques, inflation, taux, énergie, emploi, évolution réglementaire, cybermenaces, indisponibilité PSP, tensions logistiques et événements géopolitiques pertinents.

Pour chaque signal :
- source primaire/autorité, date, zone géographique, fraîcheur et niveau de confiance ;
- distinguer fait confirmé, signal faible, hypothèse et rumeur ;
- évaluer exposition PROCHÉLIA, clients, intervenants, partenaires, trésorerie et infrastructure ;
- construire scénarios 7/30/90 jours et stress tests ;
- recommander actions de continuité, responsables, déclencheurs et seuils d'escalade.

Playbooks minimaux : crise de trésorerie, panne PSP, cyberincident, fuite de données, indisponibilité Cloudflare, fraude, hausse brutale des coûts, baisse de demande, crise de réputation, rupture partenaire et changement réglementaire. Les décisions impliquant paiements, suspension d'activité, communication publique, données ou contrats nécessitent une validation humaine.

## 4. Boucle exécutive de décision

Cycle obligatoire :
1. Collecte autorisée et validation de qualité.
2. Contrôle tenant, période, devise, fraîcheur et complétude.
3. Calcul reproductible des KPI.
4. Diagnostic et analyse des causes.
5. Scénarios prudent / central / ambitieux.
6. Recommandation classée par impact, urgence, confiance et réversibilité.
7. Fiche de décision : objectif, faits, hypothèses, coût, bénéfice, risque, alternative, propriétaire, date limite, seuil d'arrêt.
8. Approbation si nécessaire.
9. Exécution via outil autorisé, idempotent et journalisé.
10. Vérification du résultat et comparaison au scénario.
11. Apprentissage : mise à jour des hypothèses, jamais altération silencieuse des faits.

Chaque recommandation doit afficher : « pourquoi maintenant », « ce qui pourrait invalider cette recommandation », « coût maximal », « risque client », « impact intervenant », « impact trésorerie », « confiance » et « comment mesurer le résultat ».

## 5. Niveaux d'autonomie et permissions

- L0 OBSERVER : lecture strictement autorisée, contrôles qualité, alertes.
- L1 CONSEILLER : diagnostics, prévisions, recommandations, scénarios.
- L2 PRÉPARER : brouillons de campagnes, offres, négociations, tarifs, contrats, tickets, changements de code et plans d'action ; aucune publication/engagement.
- L3 EXÉCUTER SOUS GARDE : uniquement actions allowlistées, réversibles, à faible risque, plafonnées, tenant-scoped, idempotentes, avec politique approuvée et journalisation.

Approbation humaine obligatoire : paiements, reversements, remboursements hors seuil explicitement autorisé, changement de coordonnées bancaires, contrat/signature, acceptation d'offre, engagement/exclusivité, dépense publicitaire, publication publique, tarif/commission en vigueur, suspension/fermeture de compte, export/suppression de données, transfert international, déclaration réglementaire, changement de secret/politique, migration ou déploiement Production.

Nexus ne peut jamais s'auto-accorder une permission, créer sa propre approbation, contourner un refus, modifier ses limites, ni approuver sa propre action.

## 6. Outils et intégrations nécessaires

Connecteurs à sélectionner et sécuriser selon le besoin :
- données internes PROCHÉLIA via API authentifiée et scopes tenant ;
- Cloudflare Workers, D1, R2, logs, métriques, alertes et déploiements Preview ;
- GitHub issues, pull requests, CI, code review et releases ;
- PSP via API officielle, webhooks signés, idempotence, rapprochement et sandbox ;
- comptabilité/banque via exports ou connecteurs autorisés et rapprochement ;
- CRM, support, email et calendrier via connecteurs consentis ;
- analytics produit, consent management et attribution marketing ;
- sources publiques officielles pour veille économique, réglementaire et géopolitique ;
- outils de design, tests navigateur, accessibilité et performance.

Chaque intégration doit avoir un propriétaire, une finalité, un périmètre de données, des scopes minimaux, un secret géré, une rotation, une journalisation, une procédure de révocation et un mode dégradé. Pas de collecte massive ni de scraping contraire aux conditions d'utilisation.

## 7. Architecture logique cible

- Nexus Control Plane : politiques, rôles, tenant, autorisations, budgets, approbations, kill switch.
- Data Foundation : événements métier, registre financier, référentiels, dictionnaire KPI, qualité et provenance.
- Intelligence Layer : calculs déterministes, prévisions, détection d'anomalies, recherche documentaire sourcée et modèles IA.
- Executive Decision Engine : scénarios, recommandations, priorisation, fiches de décision et suivi.
- Workflow Orchestrator : tâches, outbox, retries, idempotence, compensations et réconciliation.
- Tool Gateway : adaptateurs à scopes minimaux et allowlist d'actions.
- Audit & Observability : journaux append-only, traces, alertes, preuves et export de contrôle.
- Executive Cockpit : objectifs, finance, croissance, clients, intervenants, partenariats, marketing, risques et expansion.

Les calculs financiers, droits, règles de validation et transitions d'état doivent rester déterministes côté serveur. Le modèle IA interprète et recommande ; il ne devient jamais la source de vérité.

## 8. Tableau de bord exécutif — indicateurs obligatoires

- Croissance : GMV, CA reconnu, nouveaux clients, conversion, rétention, fréquence.
- Économie : revenu plateforme, commission, coût PSP, remboursements, marge contributive, résultat et runway.
- Trésorerie : soldes bancaires/PSP rapprochés, fonds en transit, réserves, passifs intervenants, litiges et reversements.
- Client : économie mesurée, délai, qualité, réclamation, résolution, satisfaction.
- Intervenant : revenu brut/net, frais, taux d'acceptation, ponctualité, annulations, satisfaction.
- Acquisition : CAC par canal, ROAS, incrémentalité, payback, valeur par cohorte.
- Partenariats : pipeline pondéré, taux de conversion, revenu net, concentration, renouvellement.
- Opérations : missions réalisées, incidents, remplacements, SLA, coût de service.
- Risque : fraude, sécurité, RGPD, dépendances, conformité, disponibilité et incidents.
- Fiabilité : complétude, fraîcheur, taux de rapprochement, erreurs, tests et disponibilité.

Chaque KPI a une définition, formule, source, fréquence, devise, périmètre, propriétaire et limites. Aucun KPI ne peut être présenté sans statut ACTUAL / RECONCILED / ESTIMATE / FORECAST.

## 9. Feuille de route de livraison et critères de sortie

### P0 — sécurité et vérité des données
- Authentification/session serveur et contexte tenant réel.
- Tenant_id et politiques d'accès sur toutes les tables/queries métier.
- Rapprochement financier et dictionnaire KPI.
- Tarification serveur versionnée et approuvée.
- Suppression des effets automatiques non autorisés.
- Tests cross-tenant, idempotence, approbations, restauration D1 et audit.

### P1 — cockpit de pilotage
- API KPI filtrées par tenant/période/devise.
- Cockpit finance, opérations, clients, intervenants et qualité.
- Alertes et recommandations read-only avec sources et fraîcheur.
- Décisions tracées et mesure à 7/30/90 jours.

### P2 — croissance commerciale
- CRM et pipeline partenariats.
- Acquisition, rétention, referral et mesure incrémentale.
- Génération de briefs, propositions et campagnes en brouillon.
- Simulation tarifaire et économie unitaire par segment.

### P3 — Nexus orchestrateur contrôlé
- Connecteurs autorisés, approbations, outbox, limites et kill switch.
- Actions L3 limitées à l'allowlist réversible.
- Tests de charge, chaos, sécurité et reprise.
- Évaluation indépendante des performances et dérives.

### P4 — expansion nationale et internationale
- Matrice pays/activité, conseil juridique, fiscalité, PSP, assurance, données et capacité opérationnelle.
- Pilote local limité, critères de succès et arrêt.
- Déploiement pays par pays après validation.

**NO-GO Production tant que tous les P0 et les gates de sécurité, conformité, restauration, paiements sandbox et recette bout-en-bout ne sont pas prouvés.**

## 10. Principes non négociables

- La croissance ne justifie jamais fraude, tromperie, dark patterns, discrimination, exploitation ou non-conformité.
- Le gain client et le revenu net intervenant comptent autant que la commission plateforme.
- Pas de promesse de richesse, de rendement garanti ou de supériorité absolue de l'IA.
- Toute prévision expose hypothèses, fourchettes et risques.
- Toute action est autorisée, limitée, réversible si possible, idempotente et auditable.
- L'humain garde la décision sur les actes engageants et les risques élevés.
- PROCHÉLIA reste maître de ses données, de ses politiques et de ses accès.

## 11. État de réalisation

Ce document définit la cible fonctionnelle et technique. Il ne signifie pas que les modules, connecteurs, autorisations, calculs, dashboards, modèles IA ou automatisations sont déjà développés, testés ou déployés. Chaque capacité doit être livrée dans une PR distincte, testée sur données de test et validée avant activation.
