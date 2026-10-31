# PROCHÉLIA NEXUS × PROCHÉLIA LIFE — architecture produit et croissance V1

**Statut :** spécification cible à intégrer progressivement. Ce document ne certifie pas que les modules décrits sont déjà développés ou opérationnels.  
**Branche de travail :** `feat/supra-intelligence-governance-v1`  
**Principe directeur :** une seule plateforme cohérente, une identité commune, un compte utilisateur unique et des activités interconnectées, sans duplication des catalogues, clients, professionnels, paiements ou règles.

## 1. Vision et architecture de marque

### PROCHÉLIA LIFE — la marque mère et l'écosystème
PROCHÉLIA LIFE est la marque ombrelle qui rassemble l'ensemble des activités, services, talents, créateurs, opportunités et offres professionnelles. Les modules ne deviennent pas des plateformes indépendantes : ils partagent le socle de compte, d'identité, de catalogue, de commandes, de paiement, de réputation, de conformité et de pilotage.

### PROCHÉLIA NEXUS — le système nerveux opérationnel
NEXUS est la couche de coordination de l'écosystème. Elle relie les domaines, les parcours, les données et les flux économiques. Elle orchestre les dépendances, les événements, les règles communes, les indicateurs, les contrôles et les décisions inter-domaines. NEXUS ne contourne jamais les autorisations métier : chaque action reste soumise au contrôle d'accès, à la politique d'autonomie et aux validations requises.

### IA SUPRA — l'intelligence transversale
SUPRA est le copilote exécutif et opérationnel de NEXUS. Il analyse, anticipe, simule, compare, prépare, coordonne et vérifie les actions dans tous les domaines autorisés. Il s'appuie sur des capacités spécialisées par domaine, mais conserve une vue transversale des objectifs, risques, coûts, marges, qualité et obligations. Il ne doit jamais inventer une preuve, un résultat, un paiement, une conformité ou une exécution.

### Trois couches complémentaires
1. **LIFE :** marque, proposition de valeur, portefeuille d'activités et expérience unifiée.
2. **NEXUS :** orchestration métier, données, événements, règles et coordination des opérations.
3. **SUPRA :** intelligence, aide à la décision, simulation, automatisation gouvernée et contrôle des résultats.

## 2. Règles structurantes non négociables

- Un compte et une identité communs avec des rôles et permissions distincts selon les usages.
- Un catalogue central et versionné ; chaque offre appartient à un domaine mais respecte le même contrat de données.
- Un moteur unique de devis, commandes, tarification, remises, taxes, paiements et rapprochement.
- Un portefeuille de revenus consolidé, avec ventilation comptable par activité, entité, pays et canal.
- Une réputation et un historique cohérents, avec séparation stricte des données privées et des droits d'accès.
- Une expérience multi-supports : iOS, Android, tablette et ordinateur ; responsive, accessible et progressive.
- Une architecture multilingue et multi-pays conçue dès le départ, sans activer un pays avant validation locale.
- Aucun doublon de logique métier : les interfaces consomment les règles et données serveur.
- Aucun effet financier, juridique, contractuel ou irréversible déclenché par SUPRA sans autorisation explicite.
- Les fonctions non construites ou non testées restent identifiées comme telles.

## 3. Portefeuille d'activités PROCHÉLIA LIFE

### 3.1 SERVICES
Le cœur des services à domicile et de proximité : accompagnement, présence, aide du quotidien, courses, tâches ménagères et prestations autorisées au catalogue. Le périmètre de chaque prestation précise description, durée, exclusions, prérequis, zone, niveau de risque, qualifications et règles applicables.

Parcours commun : découverte → demande → qualification → devis → commande → paiement selon le modèle retenu → acceptation/affectation → réalisation → preuve de service → clôture → facture → avis ou réclamation.

### 3.2 TALENTS
Un espace de valorisation et de mise en relation des compétences : profils professionnels, compétences vérifiées, disponibilités, zones, expériences, qualifications et opportunités de missions. Le matching doit être explicable, fondé sur des critères pertinents et contrôlé contre les biais et discriminations. Les statuts juridiques et les responsabilités doivent être validés avant toute mise en relation ou contractualisation.

### 3.3 LIVE & CRÉATEURS
Un canal de présentation, démonstration et découverte commerciale en direct ou en différé : créateurs, experts, intervenants et partenaires peuvent présenter des services, savoir-faire, contenus et offres autorisées. Les parcours incluent modération, consentements, droits à l'image et d'auteur, transparence des partenariats, règles promotionnelles et mesure de conversion. Les diffusions et promotions ne sont pas activées sans contrôles appropriés.

### 3.4 OPPORTUNITÉS
Un espace de développement commercial et de croissance : partenariats, demandes B2B, appels à collaboration, offres territoriales, licences, abonnements, recommandations, parrainage et opportunités de distribution. Chaque opportunité suit un pipeline traçable avec propriétaire, valeur estimée, probabilité, coûts, prochaine étape et résultat réel.

### 3.5 B2B / ENTREPRISES
Comptes entreprise, multi-sites, gestionnaires délégués, catalogues et tarifs contractuels, devis, commandes groupées, contrats-cadres, facturation périodique, justificatifs, reporting et rapprochement. Séparation des données par organisation et contrôle d'accès au niveau de chaque ressource.

## 4. Socle commun de plateforme

### Identité et accès
Compte unifié, authentification robuste, récupération sécurisée, MFA/OTP lorsque requis, gestion des sessions et appareils, vérification des profils, rôles et permissions. Les données sensibles et pièces justificatives sont accessibles uniquement aux personnes habilitées.

### Catalogue, offres et tarification
Catalogue central avec versions, zones, langues, durées, options, disponibilités, conditions, taxes et règles d'éligibilité. Une prestation active doit être reliée à un tarif serveur actif. Les remises ne proviennent que de promotions validées. Les majorations sont calculées à partir des dates et horaires réels de mission. Les plafonds réglementaires et le traitement des frais de déplacement doivent être paramétrés par juridiction et validés par une expertise compétente.

### Devis, commandes et cycle de vie
Le cycle canonique doit être défini et implémenté côté serveur, avec transitions autorisées, contrôles de concurrence, historique et idempotence. Cycle de référence à adapter aux cas réels : BROUILLON → DEVIS → PAIEMENT/INTENTION DE PAIEMENT → PAYÉ/CONFIRMÉ → ACCEPTÉ/AFFECTÉ → EN COURS → TERMINÉ → RAPPROCHÉ. Les branches ANNULÉ, REFUSÉ, EXPIRÉ, CONTESTÉ, REMBOURSÉ et AVOIR sont gérées explicitement. Ne jamais marquer une commande payée ou terminée sans preuve du PSP ou de l'exécution métier.

### Paiements, comptabilité et portefeuille de revenus
Un ledger immuable et réconciliable enregistre les montants dus, encaissés, reversés, remboursés, les taxes, commissions, frais PSP et ajustements. Une formule comptable de référence calcule :
- total payé par le client ;
- net dû à l'intervenant ou au fournisseur ;
- commission fixe et variable de PROCHÉLIA ;
- frais de paiement et coûts variables ;
- taxes et retenues applicables ;
- marge contributive nette par commande et activité.

Les frais PSP, commissions et marges ne doivent jamais être confondus. Les écritures sont idempotentes, rapprochées des webhooks et des relevés du prestataire de paiement. Les simulations ne sont pas des transactions réelles.

### Confiance, réputation et service client
Avis vérifiés, signalements, réclamations, médiation, incidents, remboursements selon politique validée, support et suivi qualité. Les décisions humaines sensibles sont escaladées et auditées.

## 5. PROFITABILITY ENGINE — moteur de rentabilité et de croissance

Le moteur doit mesurer la rentabilité réelle et non uniquement le chiffre d'affaires brut.

### Indicateurs obligatoires
- Chiffre d'affaires encaissé et reconnu, par activité, canal, territoire et période.
- Marge brute et marge contributive nette après commissions, PSP, coûts variables, remboursements et coûts opérationnels attribuables.
- Partage de valeur et rentabilité pour les trois parties : client (valeur/prix/qualité), intervenant (revenu net/temps/frais) et PROCHÉLIA (commission/marge/coûts).
- CAC réel par canal, incluant le temps commercial, les partenariats, les incentives, les contenus et les dépenses publicitaires ; distinguer CAC monétaire et CAC complet.
- Valeur vie client, réachat, rétention, fréquence, panier moyen, taux de conversion, annulation, litige et satisfaction.
- Trésorerie, créances, dettes, délais d'encaissement et de reversement, prévision glissante de trésorerie à 13 semaines.
- Coût d'acquisition et rentabilité des créateurs, programmes de parrainage et campagnes LIVE.
- Rentabilité des contrats B2B, licences, abonnements et partenariats.
- Coût de service par mission, territoire et catégorie, capacité disponible et taux d'utilisation.

### Sources de revenus à piloter
1. Commissions sur commandes et mises en relation, selon le cadre contractuel validé.
2. Offres et contrats B2B, services multi-sites et prestations récurrentes.
3. Abonnements et fonctionnalités professionnelles, uniquement avec valeur réelle et conditions transparentes.
4. Licences et partenariats de distribution ou d'exploitation.
5. Programmes de parrainage et apport d'affaires encadrés.
6. LIVE, créateurs et campagnes commerciales avec rémunérations/commissions transparentes.
7. Services additionnels autorisés, options et offres premium clairement décrites.

Chaque source doit avoir un compte analytique, des coûts directs et indirects attribués, des règles de reconnaissance et un tableau de bord. Ne jamais additionner des revenus estimés à des encaissements réels.

### Décisions de gestion
SUPRA peut proposer : lancer, tester, corriger, suspendre ou abandonner une offre. Toute recommandation présente hypothèses, données sources, incertitudes, seuils, coûts, marge attendue, scénario prudent et critères d'arrêt. Les changements de prix, commissions, budgets, dépenses, remboursements et contrats nécessitent validation humaine.

## 6. Expérience unifiée : les espaces

- **Client :** découverte, comparaison, demande, devis, réservation, paiement, suivi, documents, support, avis, fidélité et parrainage.
- **Intervenant :** profil, vérifications, compétences, disponibilités, missions, acceptation, planning, pointage, justificatifs, revenus, factures et support.
- **Gérante / Entreprise :** cockpit de pilotage, utilisateurs, catalogue, commandes, matching, tarification, trésorerie, comptabilité, partenaires, B2B, conformité, litiges, analyses et gouvernance SUPRA.
- **Créateur / Partenaire :** profil et statut, contenus, offres, campagnes, consentements, performances, rémunérations et contrats ; les permissions sont distinctes des rôles Client et Intervenant.

Les interfaces peuvent présenter des parcours adaptés, mais les règles, calculs, identités et données restent centralisés dans les services serveur.

## 7. PROCHÉLIA NEXUS — domaines d'orchestration

NEXUS maintient un registre de domaines avec propriétaire, API/contrat, données maîtres, événements émis/reçus, permissions, indicateurs, tests et statut de maturité :
- Direction, gouvernance, objectifs et portefeuille.
- Services, catalogue, commandes et opérations terrain.
- Talents, intervenants, compétences et matching.
- LIVE, créateurs, contenus et campagnes.
- Opportunités, partenariats, B2B et croissance.
- Clients, expérience, fidélisation et support.
- Tarification, promotions et revenue management.
- Finance, trésorerie, comptabilité, ledger et rapprochement.
- Marketing, acquisition, parrainage et réputation.
- Juridique, contrats, assurances et conformité.
- Sécurité, fraude, identité et gestion des incidents.
- RGPD, droits, conservation, archivage et suppression.
- Produit, données, qualité, innovation et expérimentation.
- Infrastructure, disponibilité, coûts, sauvegardes et continuité.
- International, localisation, fiscalité et conformité pays.

Chaque domaine peut être assisté par un agent spécialisé, mais les agents n'ont pas de privilèges implicites : permissions minimales, contrats de sortie, journalisation et supervision s'appliquent partout.

## 8. IA SUPRA — autonomie transversale de bout en bout, gouvernée

### Capacités attendues
- Comprendre une demande et identifier tous les domaines concernés.
- Détecter anomalies, incohérences, doublons, risques, opportunités et dérives.
- Rechercher les données internes autorisées et distinguer faits, hypothèses et inconnues.
- Relier les impacts client, intervenant, opération, finance, juridique, sécurité et réputation.
- Simuler plusieurs scénarios et comparer coût total, marge, délai, qualité, risques et réversibilité.
- Construire un plan d'action séquencé, assigner les tâches et suivre les dépendances.
- Exécuter uniquement les actions autorisées via des adaptateurs vérifiés.
- Vérifier les résultats réels, rapprocher les systèmes et produire une preuve d'exécution.
- Apprendre des retours validés, sans transformer une hypothèse ou une donnée erronée en vérité métier.

### Niveaux d'autonomie
- **N0 — Observation :** lecture autorisée, synthèse et alertes.
- **N1 — Préparation :** diagnostic, brouillons, plans, simulations et tâches proposées.
- **N2 — Exécution réversible bornée :** uniquement sur périmètre préautorisé, avec limites, tests, journalisation et mécanisme d'annulation.
- **N3 — Orchestration multi-domaines :** séquencement d'actions autorisées, avec contrôles et validations humaines aux points requis.
- **N4 — Pilotage adaptatif :** optimisation continue des indicateurs et propositions de changement ; aucun pouvoir implicite sur les décisions réservées à la Gérante.

Ces niveaux sont une cible de gouvernance, pas un niveau déjà acquis. Une capacité ne monte de niveau qu'après validation des tests, droits, preuves, limites, sécurité et réversibilité.

### Actions réservées à validation explicite
Paiements, remboursements, reversements, changement de commission ou de tarif, activation de promotion, dépenses, engagements contractuels, décisions affectant le statut ou la situation d'une personne, export/suppression de données, lancement d'un pays, communication externe non préapprouvée et décisions juridiques. Les urgences médicales, violences, suspicions de maltraitance et situations à risque sont escaladées à l'humain et aux services compétents.

## 9. Développement national puis international

### Déploiement national
- Commencer par un territoire pilote et des catégories de prestations maîtrisées.
- Mesurer densité de demande, disponibilité, délai de réponse, qualité, coût de déplacement et marge nette.
- Construire des playbooks reproductibles : acquisition, recrutement/qualification, lancement local, support, qualité, sécurité et partenariats.
- Étendre par zones seulement lorsque les seuils de qualité, capacité, rentabilité et conformité sont atteints.
- Éviter la croissance artificielle fondée uniquement sur le volume ou les promotions non rentables.

### Préparation internationale
Architecture prête pour langues, devises, fuseaux horaires, formats, taxes, règles de prix, moyens de paiement, contrats, support et conservation des données par pays. Chaque pays nécessite une étude et validation locales portant sur statut des prestataires, droit du travail, consommation, fiscalité, protection des données, assurance, sécurité, paiements, partenaires et responsabilités. L'ouverture est une décision explicite de la Gérante après revue locale qualifiée.

### Modèle de déploiement
Pays → région → territoire → zone opérationnelle. Chaque niveau possède ses indicateurs, responsables, coûts, règles locales et seuils d'ouverture/maintien/suspension. Le socle produit reste commun ; les paramètres locaux sont versionnés et isolés.

## 10. Innovation et différenciation durable

L'avantage concurrentiel doit provenir d'une exécution supérieure et mesurable, pas de promesses impossibles :
- coordination NEXUS entre services, talents, créateurs et opportunités ;
- SUPRA capable d'analyser un problème de bout en bout et de vérifier sa résolution ;
- rentabilité transparente et équilibrée entre client, professionnel et plateforme ;
- matching explicable fondé sur qualité, disponibilité et compétences ;
- parcours multi-canaux et LIVE intégrés au catalogue et aux commandes ;
- pilotage de la qualité, continuité et confiance ;
- architecture modulaire, API documentées, portabilité des données et réduction de la dépendance fournisseur ;
- expérimentation encadrée avec mesure d'impact, critères d'arrêt et historique des décisions.

## 11. Architecture technique et intégration au projet existant

- Réutiliser l'API, le registre de domaines et le planificateur SUPRA déjà présents dans la branche de travail ; ne pas créer un deuxième moteur parallèle.
- Faire de NEXUS une couche d'orchestration au-dessus des domaines existants, avec contrats et événements communs.
- Conserver un modèle de données maître pour identités, catalogue, commandes, paiements, professionnels, organisations et territoires.
- Introduire les nouveaux modules par contrats API, migrations versionnées et tests ; éviter les écritures D1 tant que la recette n'est pas terminée.
- Garder les environnements développement, preview/préproduction et production strictement séparés. La base de production ne sert jamais aux tests d'écriture.
- Utiliser des adaptateurs sandbox pour PSP, notifications, stockage, géolocalisation, signature et services tiers.
- Journaliser corrélation, acteur, domaine, décision, approbation, exécution et preuve sans exposer de données personnelles dans les logs.
- Prévoir idempotence, contrôle de concurrence, files de reprise, DLQ, timeouts, limites de coût et mécanismes de compensation.
- Concevoir les API pour versionnement, compatibilité, observabilité et tests de contrat.

## 12. PROFIL DE MATURITÉ — registre anti-promesse

Chaque capacité porte l'un des statuts suivants :
- **CIBLE** : décrite dans cette architecture, pas encore implémentée.
- **CONÇUE** : contrat, règles et parcours documentés.
- **IMPLÉMENTÉE** : code présent dans une branche identifiée.
- **TESTÉE** : tests automatisés et résultats conservés.
- **VALIDÉE EN PRÉPRODUCTION** : parcours complet testé avec services sandbox et données isolées.
- **AUTORISÉE EN PRODUCTION** : revue sécurité/conformité, approbation et déploiement contrôlé réalisés.
- **OPÉRATIONNELLE** : surveillance et preuves d'usage réel disponibles.

Un statut ne peut pas être avancé par déclaration. Il doit être justifié par commit, tests, environnement, rapport et responsable.

## 13. Feuille de route d'intégration

### Lot 1 — fondations et cartographie
- Relier ce document à l'architecture SUPRA V2 existante.
- Établir le registre des domaines LIFE/NEXUS/SUPRA et la matrice de couverture.
- Identifier les composants déjà présents, les doublons éventuels et les écarts.
- Définir les contrats communs : identité, catalogue, devis/commande, ledger, événements et audit.

### Lot 2 — moteur économique commun
- Unifier calcul serveur des prix, remises, majorations, frais, commissions, PSP, taxes et marges.
- Définir les comptes analytiques par activité et le ledger réconciliable.
- Implémenter les KPI de rentabilité, CAC réel et trésorerie à 13 semaines.
- Tester annulations, remboursements, litiges, webhooks dupliqués et écarts de rapprochement en sandbox.

### Lot 3 — modules LIFE
- Consolider SERVICES et TALENTS.
- Ajouter les contrats de domaine LIVE & CRÉATEURS.
- Ajouter OPPORTUNITÉS et B2B.
- Relier chaque module au catalogue, aux commandes, au compte commun et aux indicateurs.

### Lot 4 — NEXUS et SUPRA
- Orchestration inter-domaines, dépendances et événements.
- Plans d'action traçables, niveaux d'autonomie et approbations.
- Adaptateurs sandbox, vérification post-action et compensation.
- Tests adversariaux, sécurité, qualité, coûts et dérive.

### Lot 5 — expansion nationale et internationale
- Pilote territorial et seuils de rentabilité/qualité.
- Playbook de réplication territoriale.
- Dossiers pays, localisation et validations professionnelles.
- Activation pays par pays après approbation explicite.

## 14. Conditions de recette et interdictions

Avant toute mise en production : tests unitaires, contrats API, intégration D1 isolée, E2E des espaces Client/Intervenant/Gérante/Partenaire, RBAC et propriété, sécurité, charge, idempotence, webhooks, rapprochement financier, restauration, RGPD, accessibilité, observabilité et retour arrière.

**Interdictions :**
- ne pas fusionner les PR ni déployer en production dans le cadre de cette spécification ;
- ne pas lancer de migration ou d'écriture sur la D1 de production ;
- ne pas activer un PSP, une notification, une promotion, un contrat ou un pays sans recette et validation ;
- ne pas présenter le chiffre d'affaires brut comme marge ;
- ne pas présenter un scénario, un plan préparé ou une réponse IA comme une action exécutée ;
- ne pas revendiquer une supériorité nationale ou internationale sans mesures comparatives vérifiables.

## 15. Critère final de réussite

PROCHÉLIA LIFE doit offrir un écosystème unifié et viable ; PROCHÉLIA NEXUS doit coordonner ses domaines sans duplication ; IA SUPRA doit améliorer les décisions et l'exécution de bout en bout sous gouvernance. La croissance doit être démontrée par la satisfaction, la qualité, la marge nette, la rétention, la confiance, la conformité et la capacité à répliquer le modèle d'un territoire à l'autre.
