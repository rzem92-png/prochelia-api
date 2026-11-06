# PROCHÉLIA — Gate de sécurité transactionnelle

**État : BLOQUÉ — préproduction uniquement**  
**PR de référence : #11 — brouillon, non fusionnée**  
**Règle : aucune écriture de mission, aucun encaissement réel, aucun remboursement réel et aucun payout réel tant que les critères de ce document ne sont pas validés.**

Ce document décrit les risques observés dans le code de la branche `feat/stripe-connect-onboarding` et les conditions de sortie du blocage. Il ne constitue pas une autorisation de production.

## État de l'audit — synthèse actuelle

> **Important :** les constats de la première revue ont été partiellement corrigés dans la branche. Ne pas les lire comme une description de la dernière version du code. La CI simulée ne suffit pas à prouver les garanties Cloudflare D1 en production.

### Correctifs déjà intégrés dans la branche
- Idempotence charge et payout : comparaison acteur + payload, conflit si réutilisation incompatible.
- Payout : réservation conditionnelle, insert payout et audit groupés en D1 batch.
- Webhooks : hash payload, états pending/processing/processed, lease de reprise, conflit en cas de payload différent, non-ack prématuré des événements incomplets.
- Charge payée et crédit wallet : transition et effet financier groupés dans un batch D1.
- Payouts : settlement/release par statut dans un batch, sans clamp silencieux de solde réservé.
- Remboursement : fail-closed avec `503 REFUND_LEDGER_NOT_IMPLEMENTED` tant que le ledger de remboursement n’existe pas.
- V7 permission checks : déclaratifs/non autoritaires; les routes sensibles doivent reposer sur session serveur, rôle persisté et ownership.
- Auth : rate limiting login et bootstrap initial atomique.
- Mission writes : désactivées tant que les gates de workflow, pricing, sécurité et validation client ne sont pas démontrées.

### Risques encore à démontrer par tests d’intégration Cloudflare D1
- Isolation de transactions/batch sous concurrence multi-worker.
- Atomicité effective et rollback lors de panne/crash injecté.
- Reprise après lease webhook expirée, sans double effet.
- Ledger append-only, réconciliation et réparation auditée.
- Parcours mission complet avec contrôle ownership, disponibilité/slots et transitions.
- Parcours Stripe sandbox complet, notamment remboursement, litige, payout, retry et rapprochement.

### Routes V7 — séparation validation et autorisation
- Les routes `/api/v7/check/*` sont des validations déclaratives, non une source d’autorité RBAC.
- Les rôles, permissions, statuts et IDs transmis par le navigateur sont non fiables.
- Toute autorisation effective doit être calculée côté serveur depuis la session, le rôle/statut persisté et l’appartenance à la ressource.
- Les tests négatifs doivent vérifier la falsification de `role`, `permissions`, `user_id`, `client_id`, `intervenant_id` et statuts.

**Conséquence :** même si les correctifs de code sont intégrés, les adaptateurs financiers et mission restent fail-closed jusqu’à la preuve des garanties D1 et la recette de bout en bout.

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

## Corrections intégrées — idempotence et payout

- La clé d'idempotence d'une charge mission est liée au payload (mission/client/intervenant/montants/devise) et au compte gérant initiateur. Une clé réutilisée avec un payload différent ou un autre acteur retourne un conflit; pas de replay de transaction.
- La clé payout est liée à l'intervenant, au montant et au mode. Un conflit de clé entre utilisateurs ne renvoie aucune donnée de payout.
- La réservation payout est maintenant conçue comme un bloc D1 atomique : débit disponible conditionnel (`available_cents >= amount`), crédit réservé, ligne payout et audit. Le résultat doit encore être prouvé par tests D1 Worker concurrents et injection de panne avant activation.
- Les frais, remboursements et mouvements ne doivent jamais être traités comme validés par une simple réponse API; le ledger et le webhook signé restent la source de vérité.

## Authentification — protections ajoutées

- Login : double compteur sur 15 minutes par e-mail normalisé + IP Cloudflare (seuil 5) et par IP seule (seuil 25), IP hachée, réponse 429 et `Retry-After` 900 secondes. Les tentatives expirées sont purgées au-delà de 24 h.
- Bootstrap initial : création du premier compte gérant protégée par un verrou singleton et un batch D1 atomique afin qu'une course de deux requêtes ne crée qu'un seul compte.
- Ces protections nécessitent encore une validation avec D1 réelle, comportement Cloudflare IP, tests de charge, observation anti-faux-positifs et revue de sécurité avant mise en production.

## Webhook state machine / finance side effects

- Event state: `0=pending`, `2=processing` (5-minute lease), `1=processed`. Replayed event IDs with a different payload hash are conflicts; a live lease returns retryable `409 WEBHOOK_EVENT_PROCESSING`; expired leases can be reclaimed.
- Final audit and `processed=1` are committed in one D1 batch. A failure must not be falsely acknowledged as complete.
- Paid charge transition and wallet credit now use one D1 batch with a conditional transaction state update.
- Payout completion/failure/cancellation now uses status-specific atomic wallet settlement/release; no silent `MAX(0, reserved)` clamp.
- Refund webhook effects intentionally return `503 REFUND_LEDGER_NOT_IMPLEMENTED` until refund ledger/reversal and negative-balance handling exist. Do not activate charge/refund flows before this gate passes.
- D1 concurrency, batch rollback, crash injection and Stripe test-mode webhook replay remain mandatory. CI mocks do not prove Cloudflare D1 transaction semantics.

## Litiges / disputes

- Route protégée `POST /api/payments/disputes/open` ajoutée au routeur.
- Client : sélection transaction via jointure mission → client → `user_id` de session (pas d'ID client fourni par le navigateur).
- Montant du litige strictement positif et plafonné au montant payé restant après remboursements.
- Un litige ouvert/pending par transaction; statut `paid → held`, création du litige et audit en batch D1.
- La route reste soumise aux tests D1 de concurrence et à la validation du modèle de remboursement avant toute activation de charges.

## Blocages de readiness produit/API

Le Worker n'expose pas encore de routes publiques de création de compte client/intervenant ni de flux complet mission (validation, acceptation, réservation de créneau, progression, clôture). Ces capacités ne sont donc pas considérées comme prêtes.

Les readiness flags suivants restent fermés et sont maintenant inclus dans `paymentsConfigured()` et le contrôle de production :
- `CLIENT_PROVIDER_REGISTRATION_READY=false`
- `MISSION_WORKFLOW_READY=false`
- `MISSION_SECURITY_READY=false` (presence, QR/check-in, identity and status transitions)
- `CLIENT_CODE_DELIVERY_READY=false` (no client secret/code delivered to the client yet)
- `SERVER_PRICING_POLICY_READY=false`
- `REFUND_LEDGER_READY=false`
- `PSP_RECONCILIATION_READY=false`
- `STRIPE_CHARGES_AND_PAYOUTS_READY=false`

L'onboarding Stripe Connect ne constitue pas une capacité d'encaissement, de remboursement ou de payout. Aucun de ces flags ne doit être ouvert tant que les parcours correspondants ne sont pas implémentés et testés de bout en bout.
