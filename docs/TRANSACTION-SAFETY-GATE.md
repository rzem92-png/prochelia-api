# PROCHÉLIA — Gate de sécurité transactionnelle

**État : BLOQUÉ — préproduction uniquement**  
**PR de référence : #11 — brouillon, non fusionnée**  
**Règle : aucune écriture de mission, aucun encaissement réel, aucun remboursement réel et aucun payout réel tant que les critères de ce document ne sont pas validés.**

Ce document décrit les risques observés dans le code de la branche `feat/stripe-connect-onboarding` et les conditions de sortie du blocage. Il ne constitue pas une autorisation de production.

## Constats d'audit du code existant

### Webhook `paymentWebhook()`
1. L'événement webhook est inséré dans `payment_webhook_events` avec `INSERT OR IGNORE` avant l'exécution complète des effets métier.
2. En cas de doublon d'identifiant, le handler répond `duplicate: true` sans distinguer un événement déjà traité d'un événement enregistré mais dont le traitement a échoué.
3. Les transitions `payment_transactions`, les mouvements de `wallets`, les transitions `payout_requests` et l'audit sont exécutés en requêtes D1 séparées.
4. Les contrôles de statut sont des lectures suivies d'écritures distinctes. Ils ne démontrent pas une exclusion mutuelle en cas de livraisons concurrentes.
5. Une panne intermédiaire peut laisser un état partiel; la reprise n'est pas démontrée comme sûre.

### Idempotence des opérations
- `createMissionPayment()` retrouve une transaction par `idempotency_key` et renvoie l'ancienne, mais le code ne compare pas le payload de la nouvelle demande au payload initial. Réutiliser la même clé avec une autre mission, un autre client/intervenant ou un autre montant peut retourner une transaction étrangère à la demande.
- `payoutRequest()` présente le même manque de comparaison de payload pour une clé déjà utilisée.
- L'unicité SQL protège contre certaines insertions dupliquées, mais ne remplace ni la validation du propriétaire de la clé ni la comparaison d'empreinte.

### Payout et portefeuille
- Le solde est lu puis comparé, puis décrémenté et réservé dans des statements distincts. Deux demandes simultanées peuvent toutes deux réussir la vérification préalable avant les décréments.
- La réservation du wallet et l'insertion du payout ne sont pas une opération atomique démontrée. Une panne entre les deux peut laisser une réservation sans payout correspondant.
- Les effets webhook du payout et les mouvements de wallet sont séparés; une livraison concurrente peut tenter plusieurs transitions.

### Routes V7 de validation — ne pas confondre validation et autorisation
- Les routes `/api/v7/check/*` et notamment `/api/v7/check/permissions` reçoivent des éléments de validation dans le corps de la requête. La route de permissions vérifie un rôle et un objet `permissions` fournis par l'appelant; elle ne constitue donc **pas** une source d'autorité RBAC.
- Les résultats V7 sont des validations déclaratives. Ils ne doivent jamais autoriser directement une lecture/écriture D1, une mission, un paiement, un remboursement, un payout ou une action d'administration.
- Toute autorisation effective doit être calculée côté serveur depuis la session authentifiée, le rôle et les permissions persistés, l'état du compte et le propriétaire de la ressource. Les identifiants/roles/permissions fournis par le navigateur sont non fiables.
- Ajouter des tests négatifs prouvant qu'un client/intervenant ne peut pas obtenir des privilèges en forgeant `role`, `permissions`, `user_id`, `client_id`, `intervenant_id` ou les statuts. Vérifier aussi que les routes purement consultatives ne sont pas réutilisées comme garde d'accès par les routes transactionnelles.

**Conséquence :** risques potentiels de traitement perdu, double mouvement, réservation orpheline, incohérence de solde ou retour d'une transaction incorrecte en réutilisant une clé. Les adaptateurs financiers doivent rester désactivés.

## Corrections obligatoires avant toute activation transactionnelle

- Définir une machine à états explicite et monotone : transitions autorisées, transitions terminales et refus des retours arrière.
- Idempotence métier distincte de l'idempotence PSP : clé scoped (acteur/opération), empreinte du payload, réponse stable et conflit explicite si même clé + payload différent.
- Webhook : distinguer reçu/en cours/traité/échec récupérable; ne jamais traiter un événement non finalisé comme doublon réussi. Prévoir retry/lease et reprise.
- Empêcher le traitement simultané des mêmes opérations et vérifier les contraintes SQL/retours de statements.
- Ledger append-only avec unicité par mouvement source; soldes dérivés ou maintenus par opérations atomiques garanties et rapprochables.
- Opérations D1 atomiques adaptées pour les transitions indivisibles. Payout : réservation conditionnelle atomique (available >= amount), enregistrement payout et ledger en bloc cohérent; release exactement une fois.
- Ne jamais appeler un PSP avant une réservation/idempotence durable. Utiliser la même clé d'idempotence côté PSP et PROCHÉLIA.
- Remboursements : plafond au montant encaissé moins remboursements déjà confirmés; partial/full, concurrence et replay.
- Rapprochement PSP ↔ ledger ↔ missions, file de reprise, alertes et réparation auditée.
- Missions : auth/RBAC, prix calculé côté serveur, slot/availability atomique, idempotence, transitions contrôlées et audit.

## Matrice de tests obligatoire (préproduction isolée, données synthétiques)

| Scénario | Résultat exigé |
|---|---|
| Webhook identique répété 2/10/100 fois | Un seul effet financier/ledger |
| Webhook identique concurrent sur plusieurs workers | Un seul effet métier |
| IDs webhook différents, même opération métier | Une seule opération grâce à l'idempotence métier |
| Crash après réception avant traitement | Événement récupérable/rejouable |
| Crash après transition avant ledger | Pas d'état partiel; atomicité ou réparation prouvée |
| Crash après ledger avant réponse HTTP | Retry sans double mouvement |
| Même idempotency key, payload identique | Réponse stable, pas de nouvelle mutation |
| Même idempotency key, payload différent | Conflit explicite, aucune mutation |
| Deux payouts concurrents au-delà du solde | Un seul accepté; jamais de solde négatif |
| Crash entre réservation et création payout | Aucun fonds bloqué orphelin |
| Payout PSP échoué/annulé/rejoué | Réservation libérée exactement une fois |
| Remboursement total/partiel répété/concurrent | Cumul ≤ montant remboursable |
| Signature invalide, webhook ancien, compte non lié | Refus sans mutation métier |
| Mission/slot concurrent | Une réservation, pas de double attribution |
| Reconciliation après crash | Écart détecté et réparé avec audit |
| Route V7 permissions avec role/permissions falsifiés | Ne donne jamais d'accès réel à une route protégée |
| ID de ressource appartenant à un autre compte | Refus serveur (403/404) et aucune mutation |

Les mocks seuls ne prouvent pas les transactions D1. Il faut des tests Worker-D1 isolés, des tests de concurrence et des injections de panne contrôlées.

## Critères de sortie du gate

- [ ] Revue indépendante ledger et transitions.
- [ ] Tests unitaires, D1 intégration, concurrence et reprise après panne tous verts.
- [ ] Rapprochement sans écart inexpliqué.
- [ ] Logs sans secrets ni données personnelles excessives.
- [ ] Rétention, export, suppression/anonymisation et RGPD validés.
- [ ] Stripe test mode : charge, remboursement, payout, échec, litige, retry et réconciliation validés.
- [ ] Sauvegarde/restauration testées.
- [ ] Revue sécurité, conformité juridique/financière et validation humaine formelle.
- [ ] Feature flags et rollback documentés/testés, indépendants de l'interface.
- [ ] Autorisation explicite de production de la gérante.

## Garde-fous maintenus

- `STRIPE_CHARGES_AND_PAYOUTS_READY = false`
- `SERVER_PRICING_POLICY_READY = false`
- `POST /api/missions` reste désactivé.
- Aucun vrai paiement, payout, migration D1 ou déploiement production dans cette PR.
- PR #11 reste en brouillon et non fusionnée.
