# PROCHÉLIA — Gate de sécurité transactionnelle

**État : BLOQUÉ — préproduction uniquement**  
**PR de référence : #11 — brouillon, non fusionnée**  
**Règle : aucune écriture de mission, aucun encaissement réel, aucun remboursement réel et aucun payout réel tant que les critères de ce document ne sont pas validés.**

Ce document décrit les risques observés dans le code de la branche `feat/stripe-connect-onboarding` et les conditions de sortie du blocage. Il ne constitue pas une autorisation de production.

## Constat d'audit sur le webhook

Dans `paymentWebhook()` :

1. L'événement webhook est inséré dans `payment_webhook_events` avec `INSERT OR IGNORE` avant l'exécution complète des effets métier.
2. En cas de doublon d'identifiant, le handler répond `duplicate: true` sans distinguer un événement déjà traité d'un événement précédemment enregistré mais dont le traitement a échoué.
3. Les transitions `payment_transactions`, les mouvements de `wallets`, les transitions `payout_requests` et l'audit sont exécutés en requêtes D1 séparées.
4. Les contrôles de statut sont effectués par lecture suivie d'écritures distinctes. Ils ne constituent pas une garantie d'exclusion mutuelle en cas de livraisons concurrentes.
5. Le statut de l'événement peut être mis à jour après des effets métier partiels. Une reprise après panne n'est donc pas démontrée comme sûre.

**Conséquence :** la livraison répétée, la panne au milieu du traitement ou deux événements concurrents peuvent laisser un état incomplet ou produire des mouvements de portefeuille incohérents. Les adaptateurs de paiement doivent rester désactivés.

## Corrections obligatoires avant toute activation transactionnelle

- Concevoir une machine à états métier explicite et monotone : transitions autorisées, transitions terminales, refus des retours arrière et des transitions non autorisées.
- Introduire un mécanisme d'idempotence métier distinct de l'idempotence PSP : clés uniques par opération, empreinte du payload, réponse stable et gestion des collisions de clés.
- Enregistrer un événement webhook comme **reçu** puis **traité** uniquement après réussite complète. Un événement non traité doit être récupérable après interruption; ne jamais l'acquitter comme doublon traité.
- Prévoir une stratégie de claim/lease ou de traitement concurrent qui empêche deux workers d'appliquer simultanément les mêmes effets. Le seul `INSERT OR IGNORE` n'est pas suffisant.
- Implémenter un ledger append-only avec une contrainte d'unicité par mouvement source; ne pas calculer les soldes uniquement par incréments répétés.
- Utiliser des opérations D1 atomiques/transactions adaptées pour les transitions qui doivent être indivisibles. Vérifier les résultats de chaque statement et la gestion des erreurs.
- Pour un payout, réserver les fonds de manière atomique avant appel PSP, avec clé d'idempotence stable; libérer la réservation une seule fois en cas d'échec/annulation; confirmer le débit final une seule fois.
- Pour un remboursement, limiter le montant remboursé au montant encaissé net des remboursements déjà confirmés; traiter les remboursements partiels et répétés.
- Ajouter rapprochement PSP ↔ ledger ↔ missions, une file de reprise des événements en échec et une procédure de réparation auditée.
- Les écritures de missions doivent être sécurisées séparément : auth/RBAC, validation serveur du prix, créneau atomique, idempotence, transitions de statut et audit.

## Matrice de tests obligatoire (préproduction isolée, données synthétiques)

| Scénario | Résultat exigé |
|---|---|
| Même webhook envoyé 2, 10 puis 100 fois | Un seul effet financier/ledger |
| Même webhook concurrent sur plusieurs workers | Un seul effet financier |
| Deux webhook IDs différents représentant la même opération | Une seule opération métier grâce à l'idempotence métier |
| Crash après réception, avant traitement | Événement récupérable et rejoué |
| Crash après transition, avant ledger | Pas d'état partiel; transaction atomique ou réparation démontrée |
| Crash après ledger, avant réponse HTTP | Retry sans mouvement en double |
| Deux payouts simultanés dépassant le solde | Un seul accepté; solde jamais négatif |
| Payout PSP échoué ou annulé | Réservation libérée exactement une fois |
| Remboursement total/partiel répété ou concurrent | Cumul plafonné au montant remboursable |
| Webhook ancien, signature invalide ou compte non associé | Refus sans écriture métier |
| Mission/slot concurrent | Une seule réservation; aucune double attribution |
| Idempotency-Key réutilisée avec payload différent | Refus explicite, aucune mutation |
| Rapprochement après panne | Écarts détectés et réconciliables, audit conservé |

Les tests doivent utiliser D1 isolée/restaurée, vrais tests d'intégration Worker-D1 et des injections de panne. Les mocks unitaires seuls ne prouvent pas les transactions, les contraintes SQL ni les courses concurrentes.

## Critères de sortie du gate

- [ ] Revue technique indépendante du ledger et des transitions.
- [ ] Tests unitaires, intégration D1, concurrence et reprise après panne tous verts.
- [ ] Aucune incohérence détectée dans les tests de rapprochement.
- [ ] Journalisation sans secrets ni données personnelles excessives.
- [ ] Rétention, export, suppression/anonymisation et audit RGPD validés.
- [ ] Stripe test mode : encaissement, remboursement, transfert, payout, échec, litige et réconciliation validés.
- [ ] Procédures de sauvegarde/restauration testées.
- [ ] Revue sécurité, conformité juridique/financière et validation humaine formelle.
- [ ] Feature flags et rollback documentés, testés et indépendants de l'interface utilisateur.
- [ ] Autorisation explicite de production donnée par la gérante.

## Garde-fous maintenus

- `STRIPE_CHARGES_AND_PAYOUTS_READY = false`
- `SERVER_PRICING_POLICY_READY = false`
- `POST /api/missions` reste désactivé.
- Aucun vrai paiement, payout, migration D1 ou déploiement production dans cette PR.
- PR #11 reste en brouillon et non fusionnée.
