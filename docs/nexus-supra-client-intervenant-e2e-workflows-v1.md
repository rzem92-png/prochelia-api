# NEXUS / SUPRA — spécification fonctionnelle Client, Intervenant et résolution de bout en bout

Version 1.0 — blueprint de préproduction. Ce document décrit les exigences; il ne prouve pas que les écrans, workflows ou intégrations sont déjà implémentés.

## 1. Objectif

NEXUS doit devenir un outil quotidien de travail, et non un simple annuaire ou une marketplace. Chaque client et intervenant doit pouvoir découvrir des opportunités, gérer son activité, communiquer, résoudre les problèmes et suivre les résultats depuis un espace unifié.

SUPRA est le copilote transversal. Il accompagne l'utilisateur et coordonne les fonctions NEXUS, sans contourner droits, consentements, règles métier ni validations humaines.

Principes :
- Mobile-first, responsive et accessible sur iOS, Android, tablette et ordinateur.
- Interface simple pour les utilisateurs non techniques, avec état, erreur et prochaine étape explicites.
- Cloisonnement des données selon rôle, compte, mission et organisation.
- Ne jamais annoncer une action terminée sans preuve vérifiable.
- Réutiliser les modules existants; cartographier avant de développer pour éviter les doublons.

## 2. Espace Client

### Cockpit « Aujourd'hui »
- Missions/réservations à venir, demandes et devis en attente.
- Paiements, factures, documents et échéances.
- Messages, réclamations et réponses attendues.
- Alertes utiles et recommandations SUPRA avec priorité, raison et niveau de confiance.
- Reprise de dossier avec historique et prochaines étapes.

### Recherche et découverte
- Recherche par besoin, prestation, compétence, zone, date, budget et disponibilité.
- Filtres mémorisables, profils détaillés, tarifs, conditions, portfolio et avis authentifiés.
- Comparaison expliquée, alternatives si aucun résultat et découverte équitable des talents émergents.
- Publicité sponsorisée clairement séparée du classement organique.
- SUPRA ne doit jamais inventer disponibilité, certification, avis ou information de profil.

### Demande, devis et réservation
- Formulaire adaptatif : description, lieu, date, durée, contraintes, budget, pièces utiles.
- Résumé avant transmission et consentement avant partage.
- Devis détaillé : inclus/exclus, frais, prix, conditions et validité.
- Acceptation, refus, contre-proposition avec historique.
- Statuts explicites : brouillon, demande envoyée, devis reçu, confirmation requise, confirmé, en cours, terminé, annulé, contesté.
- Prévention des doubles réservations/demandes.
- Paiement, dépense ou engagement uniquement avec confirmation adaptée.

### Suivi de mission
- Planning, consignes, documents, contacts autorisés et changements.
- Signalement retard, absence, incident, danger ou demande de modification.
- Modification acceptée par les parties; preuve de présence/réalisation uniquement via mécanisme validé.
- Fin de mission, facture/reçu et avis après prestation réelle.

### Paiements et documents
- Statut PSP distinct du statut interne : en attente, confirmé, échoué, remboursé, contesté.
- Reçus, factures, devis et historique téléchargeables.
- Support guidé en cas d'échec; aucune donnée complète de carte stockée par NEXUS.
- Remboursement ou transfert non autonome sans règles, autorisation, confirmation et preuve PSP.

### Messages, support et réclamations
- Conversation contextualisée par mission/dossier, fichiers sécurisés et historique.
- Catégories : prestation, retard/absence, qualité, sécurité, paiement, facture, compte, RGPD, bug, autre.
- Dépôt guidé avec date, faits, pièces et solution souhaitée.
- Numéro de dossier, timeline, accusé de réception, responsable, délai indicatif et recours.
- SUPRA préremplit les données autorisées pour éviter de demander plusieurs fois les mêmes informations.
- Signalement, blocage et protections anti-harcèlement/spam.

## 3. Espace Intervenant

### Cockpit professionnel
- Missions du jour/à venir, demandes, devis à répondre et messages.
- Disponibilités, calendrier, zone, capacité et conflits d'horaires.
- Revenus/transactions selon leur statut réel.
- Documents à vérifier/renouveler, réclamations et actions en attente.
- Recommandations SUPRA pour réduire les oublis, améliorer l'activité et détecter les surcharges.

### Profil et catalogue
- Présentation, compétences, prestations, tarifs, zones, disponibilités et préférences.
- Portfolio et médias avec droits d'utilisation.
- Justificatifs avec états distincts : déclaré, reçu, vérifié manuellement, vérifié par fournisseur.
- Gestion des offres, conditions, prévisualisation, publication et demandes de rectification.
- Aucun statut « vérifié » sans preuve, méthode, date et expiration éventuelle.

### Missions et planning
- Accepter, refuser, demander des précisions ou proposer un créneau.
- Gestion des indisponibilités, capacité et chevauchements.
- Checklist avant/pendant/après mission, consignes et documents.
- Déclaration de retard/incident, annulation avec motif et règles explicites.
- SUPRA peut préparer un message ou rechercher une alternative, mais ne change pas une mission et ne transmet pas des données à un tiers sans permission.

### Gestion commerciale et administrative
- Devis, factures et documents selon statut juridique et rôle.
- Suivi demandes, conversions, clients, frais et commissions transparents.
- Synthèse d'activité et revenus; ne pas prétendre remplacer un comptable.
- Aide à la rédaction, visibilité, rappels, échéances et export.
- Distinguer estimation, donnée déclarée, calcul et donnée officiellement confirmée.

### Protection
- Signalement danger, harcèlement, fraude, abus ou paiement.
- Accès à médiation/recours et suivi de dossier.
- En urgence, orienter sans retarder l'appel aux services d'urgence.
- Conserver les preuves pertinentes selon politique et accès restreint.

## 4. SUPRA transversal et proactif

SUPRA doit être accessible depuis chaque espace avec contexte, rôle et permissions propres.

Capacités : planification, coordination, recherche, matching, rédaction, devis, préparation de documents, détection de doublons/conflits de calendrier, aide paiement/facture en lecture, diagnostic informatique, support, rappels, traduction, croissance, synthèse et suivi.

SUPRA explique ce qu'il sait, ses sources, ses incertitudes et les actions réellement effectuées. Il sait s'arrêter, demander une précision ou escalader.

### Veille « toujours à l'écoute »
Ce terme signifie surveillance des événements et sources explicitement autorisés : événements applicatifs, webhooks, tâches planifiées, connecteurs consentis, alertes système, échéances et changements de statut.

- Pas de micro permanent, d'enregistrement secret ou de surveillance clandestine.
- Audio/voix uniquement après activation explicite, indication visible et consentement.
- L'utilisateur peut suspendre la veille, révoquer une source, régler les notifications et voir l'historique.
- Minimisation des données et durée de conservation limitée.

## 5. Dossier de résolution SUPRA bout en bout

Cycle obligatoire :
1. Détection : source, horodatage, contexte, identifiant.
2. Qualification : catégorie, gravité, urgence et périmètre.
3. Faits : séparer faits confirmés, déclarations et hypothèses.
4. Impact : personne, mission, finance, sécurité, réputation, conformité et continuité.
5. Diagnostic : causes possibles, confiance et données manquantes.
6. Plan : étapes, dépendances, options, coûts/risques et rollback.
7. Autorisation : identité, rôle, consentement, état métier, approbation.
8. Exécution via adaptateur serveur réel, idempotent; aucune simulation annoncée comme action réelle.
9. Vérification depuis une source de vérité ou preuve indépendante.
10. Communication claire avec résultat, limites et prochaines étapes.
11. Suivi, relance, escalade ou reprise.
12. Clôture avec critère satisfait, preuve, responsable et feedback.
13. Amélioration de procédure sans réutilisation abusive de données personnelles.

Statuts recommandés : new, triaged, waiting_user, waiting_third_party, planned, approval_required, in_progress, verification_pending, resolved, reopened, escalated, closed.

Un dossier ne devient resolved que si les critères de vérification sont satisfaits. Sinon, il reste en attente de vérification.

## 6. Conflits et réclamations
- Préserver faits et messages pertinents avec accès restreint.
- Distinguer désaccord, erreur opérationnelle, paiement, sécurité et fraude.
- Permettre aux parties de répondre et joindre des preuves.
- Procédure équitable, délais réalistes, décision motivée et recours.
- Pas de sanction automatique fondée uniquement sur une prédiction IA.
- SUPRA résume et prépare une médiation, mais ne tranche pas seul les litiges sensibles.
- Validation humaine pour remboursement contesté, pénalité, suspension ou décision majeure.

Escalade :
- P0 danger immédiat : priorité sécurité, assistance humaine et orientation urgence.
- P1 fraude, accès compromis ou données sensibles : suspendre les actions à risque et escalader sécurité.
- P2 paiement, mission interrompue ou conflit important : équipe habilitée.
- P3 incident fonctionnel/réclamation standard : support.
- P4 information ou suggestion : réponse/backlog.

Ne jamais promettre de SLA non couvert par une équipe réelle.

## 7. Support informatique SUPRA
Diagnostic : erreur exacte, heure, écran/module, appareil/navigateur, version et étapes. Collecter uniquement les données nécessaires; consulter état de service, journaux expurgés, API, connectivité et permissions autorisées.

Actions autonomes préautorisées et réversibles : consulter statut, expliquer, créer ticket, produire rapport, relancer vérification non destructive.

Confirmation requise : changer accès/configuration, déconnecter sessions, supprimer données, modifier paiement, migrer, déployer ou toucher plusieurs comptes.

La correction doit être démontrée par reproduction, test, preuve avant/après et vérification. Un patch proposé ne signifie pas que le bug est corrigé.

## 8. Matrice d'autonomie
- A0 : observer, diagnostiquer, alerter.
- A1 : préparer brouillon, plan, ticket, synthèse.
- A2 : action faible risque, réversible, préautorisée, plafonnée et idempotente.
- A3 : action externe nécessitant confirmation explicite.
- A4 : validation humaine obligatoire pour argent, contrat, litige majeur, suspension, données sensibles, décision significative, suppression irréversible, migration, production ou sécurité critique.

Chaque action vérifie identité, rôle, propriété, consentement, état serveur, quota, idempotence, audit et résultat. En cas d'incertitude : fail-closed et escalade.

## 9. Notifications et continuité
- Notifications réglables, dédupliquées et priorisées.
- Urgent/action requise/information séparés.
- Pas de spam, dark patterns ni pression artificielle.
- Liens vers dossier sécurisé, canaux et plages horaires configurables.
- Pause/silence pour veille non urgente.
- Reprise après panne sans perdre l'état ni répéter une transaction.

## 10. Sécurité, confidentialité et résilience
- RBAC, moindre privilège, propriété vérifiée côté serveur.
- CORS/CSRF, validation stricte, rate limiting, secrets côté serveur.
- Chiffrement adapté, audit minimisé, rétention/export/correction/suppression.
- Fichiers : type/taille, contrôles de sécurité, stockage privé et liens expirants.
- Cloisonnement Client/Intervenant/Gérante/Admin.
- Les messages et pièces jointes utilisateur sont des données, jamais des instructions privilégiées pour SUPRA.
- Timeouts, retries limités, backoff, circuit breaker, idempotence et rollback.
- Source de vérité définie pour chaque état.
- Dégradation contrôlée si IA, PSP ou connecteur est indisponible.
- Monitoring, alertes, runbooks, sauvegardes et tests de restauration.
- Pause/kill switch des automatisations.
- Accessibilité clavier/lecteur d'écran, contraste, états vides/erreurs et faible bande passante.
- Langue, devise, fuseau horaire et formats localisés.

## 11. Tests d'acceptation
1. Client A ne lit jamais le dossier de Client B.
2. Intervenant A ne lit jamais les données privées d'Intervenant B.
3. SUPRA refuse une action sans permission même si demandée en langage naturel.
4. Les données navigateur ne remplacent pas la source serveur.
5. Retry/double clic ne duplique pas réservation, transaction ou réclamation.
6. Disponibilité non confirmée n'est jamais présentée comme certaine.
7. Réclamation non vérifiée ne peut être clôturée comme résolue.
8. Litige sensible escaladé à un humain habilité.
9. Action financière bloquée sans autorisation et confirmation PSP.
10. Incident technique ne déclenche jamais migration/déploiement automatique.
11. Connecteur indisponible : message honnête, aucun résultat inventé.
12. Veille suspendable et sources révocables.
13. Audio jamais activé sans consentement explicite.
14. Notifications dédupliquées et préférences respectées.
15. Workflows testés avec données synthétiques en preview.
16. Vérification indépendante après exécution.
17. Audit traçable sans données privées excessives.
18. Recette mobile/tablette/ordinateur et accessibilité.

## 12. Intégration progressive
1. Inventorier routes, schémas, écrans et modules déjà présents.
2. Cartographier les écarts et réutiliser les capacités existantes.
3. Définir contrats API et états métier sans migration immédiate.
4. Ajouter tests permissions, transitions, idempotence et sécurité.
5. Première verticale : dossier support/réclamation en lecture et préparation.
6. Tester données synthétiques et D1 Preview isolée.
7. Ajouter adaptateurs un par un, avec source de vérité et vérification.
8. Recette Client/Intervenant mobile et desktop.
9. Audit sécurité, conformité, support et exploitation.
10. Validation humaine avant merge, migration ou production.

## 13. « Complet » et « indispensable » : critères mesurables
La complétude n'est pas le nombre de boutons. Elle est la capacité à accomplir les tâches essentielles, comprendre l'état du dossier, obtenir une aide fiable et reprendre après incident.

KPIs : réussite des parcours, délai de résolution vérifiée, taux de réouverture, satisfaction, conversion demande/devis/réservation/mission, temps économisé, incidents sécurité, erreurs SUPRA, actions annulées, confiance, valeur économique créée et coût IA/support.

Positionnement à tester : NEXUS rassemble activité et opportunités; SUPRA coordonne le travail, anticipe les problèmes et accompagne les membres jusqu'à une résolution vérifiée, avec contrôle, transparence et sécurité.
