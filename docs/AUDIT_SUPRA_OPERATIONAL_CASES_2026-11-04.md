# PROCHÉLIA API — Audit Copilote / opérations automatiques (2026-11-04)

## Source consultée
`src/index.js` sur `main`, fonctions autour de `executeOperationalCase`, `executeCaseBusinessAction`, `processActionOutbox`, `approveOperationalCase`.

## Findings
1. `executeOperationalCase(env, caseId, approverId=null, automatic=false)` vérifie `c.requires_manager` seulement dans la condition `if (c.requires_manager && !automatic && !approverId)`. Donc le mode `automatic=true` contourne ce garde-fou d'approbation. La question de sécurité est **si une route ou un worker peut déclencher automatic=true pour un cas qui devrait nécessiter une validation humaine**.
2. `executeCaseBusinessAction` peut mettre à jour directement le champ de mission (reschedule) avec une requête SQL, lorsque le contexte contient `reschedule_start_at`. Il faut vérifier que la mission est liée au case, que son propriétaire/acteur est autorisé, que la date est validée, et que l'action est idempotente/atomique.
3. Notifications et remboursements sont mis en file, le refund sous forme `PSP_REFUND_REVIEW`; le code décrit ce comportement comme une revue, pas comme un transfert d'argent réel. Ne pas confondre queue avec remboursement exécuté.
4. `processActionOutbox` est protégé par `requireAuthRole(...,['gerante'])`; les actions providers listées passent à `WAITING_PROVIDER`. À confirmer: traitement parallèle, verrouillage atomique, retries et doublons.
5. `executeOperationalCase` écrit les actions et résout le cas en plusieurs opérations SQL successives sans transaction visible dans l'extrait. Risque de partial state / double execution en concurrence.
6. Les écritures journales doivent rester persistantes et cohérentes avec les actions. Vérifier si journalisation peut échouer après un changement métier.

## Tests bloquants à prévoir
- automatic=true + requires_manager=true: doit rester bloqué pour finance, contrat, mission reschedule, suspension, suppression, vérification identité/document, litige.
- approbation manager de caseId inexistant, déjà résolu, autre mission/client/tenant, action modifiée après approbation.
- concurrence de deux approbations du même case (exactly-once / idempotency).
- crash simulé entre action métier, case_actions, case status et journal.
- dates de reprogrammation passées, conflit disponibilité, timezone DST, jours fériés, mission déjà démarrée.
- refunds: montant négatif, > paiement capturé, double refund, race, case client incorrect.
- outbox: deux workers, retries, provider unavailable, dead-letter et replay.
- logs: PII et secrets minimisés.

## Principes de remédiation
- Policy engine explicite: action_code -> impact -> auto_allowed -> human approval required.
- `automatic` ne doit jamais override un `requires_manager` ou une catégorie sensible.
- Approbation signée par manager doit porter sur un hash du payload exact, version de règle, case version et expiration; tout changement invalide l'approbation.
- Atomicité: transaction D1/conditional update/version lock + idempotency key unique; ne pas marquer RESOLVED avant succès de toutes les étapes.
- Action queue: états PENDING/PROCESSING/COMPLETED/FAILED/WAITING_PROVIDER, lease, retry bounded, dedupe, audit durable.
- SUPRA peut analyser, proposer, préparer et simuler; les actions sensibles (argent, contrats, mission, identité, sanctions) nécessitent confirmation explicite humaine.

## Statut
Audit statique, aucune exécution sur données réelles. Aucune modification de code, D1, secrets, Cloudflare ou production. Ces risques ne sont pas preuve d'exploitation; ils exigent revue et tests avant production.
