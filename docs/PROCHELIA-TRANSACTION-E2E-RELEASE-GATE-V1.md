# PROCHÉLIA — parcours transactionnel E2E bloquant pour la release

## Statut
Exigence de livraison obligatoire. Aucun statut « opérationnel de bout en bout », aucune release production et aucun lancement commercial à grande échelle tant que toute la chaîne ci-dessous n'est pas exécutée, vérifiée et documentée dans un environnement de recette isolé. Les tests sandbox/simulation ne prouvent pas l'exécution de paiements réels.

## Parcours métier de référence
1. Inscription client.
2. Inscription intervenant/entreprise.
3. Vérification identité/éligibilité selon les règles applicables; statut pending tant que la preuve n'est pas validée.
4. Recherche et découverte de prestations/intervenants avec prix, disponibilité, critères et visibilité équitable.
5. Création de demande/réservation, récapitulatif complet et consentement explicite aux conditions/prix.
6. Acceptation/refus par intervenant; verrouillage cohérent de la disponibilité et prévention de double réservation.
7. Paiement PSP en sandbox : autorisation, échec, timeout, retry, webhook dupliqué, webhook retardé, idempotence et statut exact. Ne jamais simuler une confirmation comme si elle venait du PSP.
8. Mission confirmée et visible aux deux parties; messages/notifications et changements de statut.
9. Début/fin de mission, QR/GPS ou preuve alternative proportionnée et consentie, sans surveillance excessive; preuve et horodatage côté serveur.
10. Preuve de réalisation; contestation client/intervenant possible. Une mission ne devient « terminée » qu'après les règles de validation prévues.
11. Règlement intervenant simulé en sandbox : éligibilité, délai, frais, échec, retry, idempotence, payout pending/succeeded/failed et rapprochement.
12. Avis/notation après mission, anti-abus, droit de réponse/modération et protections contre avis frauduleux.
13. Assistance, réclamation et litige : ouverture, catégorie, pièces autorisées, échéances, communication des deux parties, escalade et décisions humaines.
14. SUPRA : triage, collecte des preuves, identification de la cause, options, recommandation, action autorisée ou approbation humaine, suivi et vérification indépendante. SUPRA ne doit jamais inventer un statut, une preuve ou une résolution.
15. Rapprochement comptable : mission, commande, paiement, frais PSP, commission, taxes, remboursement, payout, facture/avoir et ledger; écarts détectés et signalés. Ne pas confondre GMV, chiffre d'affaires plateforme, revenus intervenants et fonds en transit.

## Scénarios obligatoires

- Accès interdit à la mission d’autrui (contrôle d’autorisation côté serveur, y compris ID substitué).

- Happy path de bout en bout.
- Client ou intervenant abandonne en cours de parcours.
- Réservation concurrente du même créneau; une seule doit réussir.
- Paiement refusé, timeout, webhook absent, webhook dupliqué, webhook hors ordre.
- Double clic, répétition de requête, retry réseau; pas de double charge, mission, remboursement ou payout.
- Annulation client/intervenant et politique de frais/refund.
- Mission non réalisée, preuve manquante ou contestée.
- Remboursement total/partiel et litige.
- Payout refusé/retardé et réconciliation.
- Compte suspendu ou preuve identité expirée.
- Client/intervenant tente d'accéder à la mission d'autrui (403/404 approprié).
- SUPRA manque de données, sources contradictoires, risque élevé, action irréversible ou connecteur indisponible : fail-closed, escalade et pas de fausse résolution.
- Panne DB/PSP/notification, reprise, idempotence et journalisation.
- Suppression/retention/anonymisation conforme aux règles applicables et sans casser les obligations comptables/litiges.

## Assertions automatiques
- Authentification et RBAC/ownership côté serveur sur chaque opération.
- Aucun secret, document d'identité ou donnée sensible dans les logs inutiles.
- Machine d'état valide; transitions interdites rejetées.
- Idempotency keys pour les opérations financières et transactionnelles critiques.
- Ledger append-only/auditable et rapprochement traçable.
- Webhooks PSP authentifiés, signature vérifiée, rejouabilité contrôlée.
- Pas de paiement réel ni de D1 production dans les tests.
- SUPRA respecte les niveaux d'autonomie; haute sensibilité/finances/juridique/production nécessitent approbation humaine.
- Tous les changements d'état critiques sont audités avec actor, source, timestamp, correlation ID et justification.
- Les erreurs ne divulguent pas les données d'autres utilisateurs.
- Accessibilité et parcours responsive testés sur iOS Safari, Android et desktop.

## Evidence / release gate
Chaque scénario produit un rapport avec commit SHA, environnement, version DB/schema, données de test non réelles, résultat, logs expurgés, anomalies et responsable de validation. CI verte seule n'est pas une recette E2E.

Le release gate reste NO-GO tant que :
- chaque scénario P0/P1 n'est pas PASS ou exception documentée approuvée;
- aucune vulnérabilité critique/haute non acceptée n'est ouverte;
- sandbox PSP et rapprochement sont validés;
- restauration sauvegarde testée;
- conformité/RGPD et contrats sont revus par les personnes compétentes;
- Gérante donne une validation explicite sur une release identifiée.

## Découpage d'implémentation
A. Contrats API et machines d'état transactionnelles.
B. Persistance isolée en Preview/test D1 avec contraintes et migrations versionnées (jamais production pour les tests).
C. Auth/RBAC/ownership et sessions.
D. UI client + intervenant + admin/support.
E. PSP sandbox et webhooks authentifiés.
F. mission/proof/avis/refunds/payout simulation.
G. SUPRA case orchestration, approbations et escalades.
H. ledger, reconciliation et dashboard.
I. tests contractuels, integration, concurrency, E2E, sécurité et mobile.
J. rapport de recette et décision release.

## Current truth
Ce document est un critère et un plan d'acceptation. Il ne prouve pas que le parcours est implémenté. Chaque composant doit être référencé par commit, test et résultat réel avant de le marquer done.
