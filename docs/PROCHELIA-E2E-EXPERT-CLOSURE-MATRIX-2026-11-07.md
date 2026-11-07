# PROCHÉLIA — Matrice de clôture expert E2E
Date de référence : 2026-11-07
Branche : preprod/r2-eu-binding-isolated-2026-11-07
Statut : registre de recette préproduction — PAS une autorisation de production.

## Règles de sécurité de livraison
- Préproduction isolée uniquement. Ne pas merger de PR, ne pas modifier production, ne pas exécuter de migration D1 ni d'opération financière réelle sans validation humaine explicite distincte.
- Toute preuve doit être attachée à un commit, une exécution CI, une capture/rapport de recette ou un identifiant de test. « Code présent » n'est pas « validé ».
- En cas d'échec, bloquer le parcours concerné, corriger sur branche dédiée et rerun les tests.
- Secrets, données personnelles et pièces d'identité ne doivent jamais apparaître dans logs, issues, rapports ou fixtures.

## Inventaire fonctionnel et critères de fermeture

| Domaine | Portée à couvrir | Critère de clôture | État de preuve |
|---|---|---|---|
| Authentification | login/logout/session, récupération, OTP si activé, bootstrap admin | tests positifs/négatifs, cookies secure, verrouillage/rate limit, audit | CSRF et session partiellement implémentés; tests actuels non confirmés |
| CSRF/CORS | token session-bound, Origin allowlist, preflight, credentials | tests absent/incorrect/correct token + navigateur cross-origin | code et tests présents; CI et navigateur à confirmer |
| RBAC | client/provider/admin, ownership et moindre privilège | matrice permissions exhaustive; tests d'accès interdit | à démontrer |
| Client | inscription/guest booking, catalogue, zone, devis, réservation, annulation, support | parcours client E2E complet sur données synthétiques | non validé |
| Intervenant | onboarding, vérification documents, compétences, disponibilités, missions, QR/check-in/out, temps/km | parcours provider complet; accès docs privé; profil public prénom seul | non validé |
| Gérante/Admin | gestion utilisateurs, rôles, missions, litiges, support, paramètres | admin MFA/step-up pour opérations sensibles, audit trail, tests RBAC | non validé |
| Nexus | matching compétences, zone, dispo, qualité, coût, préférences | tests reproductibles, explicabilité, non-discrimination et contrôle humain | conception/validation à faire |
| Tarification | prix serveur, durée, km, nuit/week-end, commissions, taxes | prix recalculé côté serveur; tests limites/arrondis/annulation | garde serveur indiquée non prête |
| Missions | création/modification/annulation, double booking, ownership, idempotence | aucune écriture activée avant tests concurrents et RBAC | actuellement fail-closed par intention |
| Paiements | Stripe Connect sandbox, intent/capture/refund, payout, frais, litiges | tests sandbox, signature webhook, idempotence, race/concurrency, rapprochement | pas de recette E2E attestée |
| Documents | upload/download, antivirus/type/size, accès, lifecycle | bucket privé, URLs signées courtes, chiffrement, purge testée | R2 configuré; lifecycle non certifié |
| R2 | PUT/GET/hash/DELETE/404, token scopes, binding | preuve smoke complète + rotation credentials + aucune donnée réelle | bucket/binding existent; smoke non confirmé |
| Notifications | email/SMS/push, retry, déduplication, opt-out | tests providers sandbox, templates FR, observabilité | à valider |
| RGPD/CNIL | minimisation, consentements, droits, conservation, suppression/anonymisation, DPA | registre, notices, workflow droits, revue DPO/juriste | revue juridique obligatoire |
| Contrats | CGU client/provider, mandat/intermédiation, prix, annulation, responsabilité | revue juridique France/SAP/consommation/social/assurance | non validé juridiquement |
| Facturation | factures/avoirs, numérotation, TVA, exports comptables | tests conformité comptable et rapprochement | à valider |
| Sauvegardes | D1/R2 backups, intégrité, restore isolé, RPO/RTO | restauration indépendante démontrée, sans toucher prod | workflows existent; preuve à récupérer |
| Observabilité | logs structurés, métriques, alertes, traces, secrets redacted | alertes testées, incidents runbook, SLO | non validé |
| Sécurité | dépendances, SAST, secrets, headers, rate limiting, abuse, pentest | revue externe ou checklist signée, vulnérabilités bloquantes = 0 | audit complet non attesté |
| Accessibilité/UI | responsive iOS/Android/tablette/desktop, clavier, contraste | recette appareils/navigateurs et WCAG ciblée | non validé |
| Performance | charge, pics, DB indexes, timeouts | test charge + seuils et rapport | non validé |
| International | Belgique puis autres pays, langues, monnaie, droit local | pays désactivé tant que validation juridique/fiscale/PSP | roadmap, pas production |
| Business | commission, CAC/LTV, marge, coûts PSP/SMS/hosting/support | simulation unit economics, seuils de rentabilité, transparence tarifs | à finaliser |
| Copilote IA | aide transversale, docs, opérations, scénarios | permissions minimales, logs, approbation humaine pour finance/juridique/contrats | garde-fous à valider |
| Production/rollback | déploiement progressif, rollback, sauvegarde préalable | checklist signée, monitoring, approbation humaine GO | BLOQUÉ |

## Ordre des prochains travaux obligatoires
1. Exécuter tests Node complets et workflow CI sur commit exact; corriger failures.
2. Ajouter tests auth/session/CSRF/RBAC et tests frontend client API; exécuter navigateur avec vrai domaine preview.
3. Vérifier les routes et toutes les surfaces frontend : supprimer les appels directs/fixtures qui contournent le client API; ne pas activer writes mission.
4. Construire la recette Client → Provider → Admin, données synthétiques seulement, et tests de double booking.
5. Terminer Stripe sandbox et test de webhooks signés/idempotents; jamais de paiements réels pour cette phase.
6. Réaliser R2 smoke complet après rotation des secrets; tests de restore dans environnement isolé.
7. Revue sécurité, conformité, contrat, comptabilité et assurance par humains compétents.
8. Obtenir les preuves de recette, faire revue finale, puis demander un GO explicite de production.

## Definition of Done (DoD)
Production interdite tant qu'une ligne critique n'a pas une preuve datée liée au commit et que les critères suivants ne sont pas tous satisfaits :
- CI verte sur SHA exact (tests unitaires, intégration, sécurité, frontend).
- Parcours client/provider/admin de bout en bout validés en préproduction.
- Aucun accès cross-tenant / RBAC / CSRF / webhook bloquant.
- Stripe sandbox + remboursement/idempotence/concurrence réussis.
- Sauvegarde et restauration RPO/RTO vérifiées en environnement isolé.
- R2 privé, permissions minimales, rotation secrets, suppression/retention testées.
- RGPD, CGU/contrats, facturation, assurances et statut d'intermédiation validés par les responsables compétents.
- Observabilité, alertes, incident runbook, rollback testés.
- Approbation humaine explicite documentée.

## Limites de ce registre
Ce document est une matrice de contrôle et non une preuve que les tests, audits, validations juridiques ou déploiements ont été exécutés. Les statuts doivent être remplacés par des liens vers des preuves réelles.


## Mise à jour des preuves CI — 2026-11-08

- Backend rate-limit identity hardening : commit `9498ab4bcec25e1ab5bd67309d2eff4065e1c188`.
- CI backend `42423385977` et `42423386015` : `success`.
- Frontend CSRF/webhook/idempotency: CI `42423101801`, `42423209792`, `42423223275` : `success`.
- Cette mise à jour clôt uniquement les preuves de tests automatisés correspondant aux commits cités. Les parcours E2E réels, la recette navigateur, Stripe sandbox, R2 restore et les validations juridiques restent `BLOCKED / NOT VERIFIED` jusqu'à preuve distincte.
