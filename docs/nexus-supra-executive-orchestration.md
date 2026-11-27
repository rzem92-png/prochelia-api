# Nexus Supra — Architecture d'orchestration exécutive PROCHÉLIA

**Statut :** proposition technique prête à implémenter, Preview/dev uniquement.  
**Objectif :** système exécutif transverse, supervisant les domaines métier et les agents spécialisés, avec exécution continue pilotée par événements, tâches planifiées et monitoring. Ce document ne prétend pas que l'autonomie H24 est déjà opérationnelle.

## 1. Principes non négociables

- Un orchestrateur central, des agents spécialisés avec périmètres explicites.
- Autonomie graduée : `OBSERVE`, `SUGGEST`, `EXECUTE_APPROVED`; jamais de mode sans garde-fous.
- Toutes les actions sont traçables, corrélées à une tâche, une décision, une politique et une version.
- Least privilege : outils, ressources, pays, tenant, environnement et budget bornés.
- Fail closed pour identité, autorisation, données, paiement, marché, conformité et intégrité.
- Les actions irréversibles/engageantes exigent validation humaine : argent/PSP, production, fiscalité ou comptabilité engageante, KYC sensible, juridique, données sensibles, activation pays, suppression, changements de sécurité.
- Kill switch global, domaine, agent et workflow; quotas, budgets, circuit breaker, retries limités et idempotence.
- Nexus ne peut jamais contourner RBAC, approbation, consentement ou protection Production.

## 2. Domaine d'orchestration

### Nexus Executive Core
- Reçoit événements, objectifs, alertes, tâches et demandes.
- Crée un plan structuré : objectifs, tâches, dépendances, échéances, critères d'acceptation, risques et budget.
- Classe par impact client, urgence, sécurité, coût, conformité, dépendances et confiance.
- Affecte aux agents via registre de capacités et politiques.
- Observe les résultats, vérifie les preuves, décide retry/escalade/arrêt.
- Maintient le tableau d'avancement et le résumé exécutif.

### Agents spécialisés (interfaces standardisées)
1. Product & UX : parcours, accessibilité, frictions, tests utilisateur.
2. Engineering : bugs, changements, tests, PR; aucun merge/déploiement prod.
3. Platform/SRE : disponibilité, logs, latence, coûts, alertes, backups et recovery.
4. Customer Operations : support, dossiers, SLA, réclamations; minimisation des données.
5. Provider Operations : profils, qualifications, documents, disponibilités, missions.
6. Matching & Scheduling : adéquation service/compétences/zone/temps, conflits, travel buffer, risques.
7. Business/Company : catalogue, équipes, contrats, devis, rapports.
8. Finance Control : calculs, commissions, ledger simulé, rapprochement, anomalie; mouvements d'argent interdits sans approval.
9. Accounting & Tax Readiness : contrôles et exports non engageants, validations experts obligatoires.
10. Security & Fraud : anomalie, abus, threat triage, vulnérabilités, escalade.
11. Legal/Compliance: matrice pays, obligations, échéances, collecte de preuves; avis juridique humain requis.
12. Internationalization: langues, devises, formats, fuseaux, unités, règles par marché.
13. Growth & Marketing: analyse agrégée, expériences avec budgets plafonnés et approbations.
14. Analytics: KPI, tendances, cohortes, qualité des données, détection d'écarts.

Chaque agent possède une déclaration machine-readable : `agent_id`, version, capabilities, allowed_tools, allowed_scopes, denied_actions, budget, max_runtime, risk_class, approver_policy, health, enabled.

## 3. Infrastructure cible Cloudflare

- Workers : API, orchestration légère, validateurs et interfaces d'agent.
- Agents SDK + Durable Objects : état coordonné de l'orchestrateur et sessions d'agents, avec accès contrôlé.
- Queues : tâches asynchrones, séparation producteurs/consommateurs, dead-letter queue.
- Workflows : étapes durables, pauses, retries, approbations, reprises et compensation.
- Cron Triggers : audits programmés, contrôles périodiques, échéances, veille et synthèses.
- D1 : tâches, plans, agents, politiques, approbations, journaux et état métier transactionnel.
- R2 : artefacts, preuves, rapports et pièces; chiffrement/contrôle d'accès et rétention.
- AI Gateway : observabilité, contrôle coût, routage/fallback et politiques d'inférence.
- Workers AI / fournisseurs LLM : abstraction provider, sélection selon tâche, qualité, coût, disponibilité et données autorisées.
- Vectorize ou AI Search : retrieval sur documents approuvés, avec ACL/tenant-aware filtering et provenance.
- Analytics Engine : métriques opérationnelles agrégées.
- Observability/logs : corrélation, traces, alertes, dashboards et SLO.
- Sandbox/Dynamic Workers : exécution de code non fiable isolée; aucun accès secrets ni réseau par défaut.

Choisir chaque produit selon les limites, coûts et disponibilité vérifiés. Ne pas déployer d'infrastructure non justifiée.

## 4. Cycle de vie d'une tâche

`RECEIVED → CLASSIFIED → PLANNED → AUTHORIZED → QUEUED → RUNNING → VERIFYING → COMPLETED`

États alternatifs : `WAITING_APPROVAL`, `RETRY_SCHEDULED`, `BLOCKED`, `ESCALATED`, `CANCELLED`, `FAILED`.

1. Valider l'événement et dédupliquer via clé d'idempotence.
2. Classifier la sensibilité, le domaine, l'impact et le risque.
3. Générer un plan JSON validé contre un schéma strict.
4. Vérifier les permissions et limites pour chaque étape; demander approval si nécessaire.
5. Exécuter dans une queue/workflow avec timeout et budget.
6. Vérifier la sortie avec tests/validators indépendants; ne pas accepter une simple affirmation du modèle.
7. En cas de retry, utiliser backoff borné; après seuil, circuit breaker et escalade.
8. Journaliser preuves, résultat, consommation et prochaine action.
9. Mettre à jour le tableau de bord; réévaluer les dépendances.

## 5. Gouvernance / sécurité

- Policy engine central, deny-by-default.
- RBAC + ABAC : rôle, agent, tenant, environnement, pays, ressource, action, sensibilité et contexte.
- Scopes OAuth/service-binding minimum; secrets dans vault/bindings, jamais dans prompts/logs.
- Tool gateway : allowlist, schéma d'entrée/sortie, rate limits, validation, audit, egress allowlist.
- Anti-prompt-injection : traiter documents/web/clients comme données non fiables; aucune instruction extraite ne peut changer policy.
- Approval records : approver humain authentifié, action exacte, résumé/risque, expiration, nonce, décision, motif.
- Isolation tenant testée sur tous endpoints et requêtes; filtrage tenant obligatoire côté serveur.
- PII minimisée, redaction logs, rétention/droit d'accès/suppression selon juridiction.
- Ledger append-only d'actions/approvals, hash chain ou signature si l'exigence d'intégrité le justifie; horodatage et export.
- Kill switches : global, par agent, outil, tenant, workflow, pays et environnement.
- Budget token/compute/financial/action par tâche, agent, journée et tenant.
- Monitoring des dérives : boucle, répétition, coût anormal, tool misuse, taux d'échec, latence, accès refusés.
- Tests de sécurité : tenant-crossing, privilege escalation, injection, replay, idempotence, approval bypass, secret leakage, SSRF/egress, output poisoning.

## 6. Modèle de données minimum

- `nexus_tasks`: id, tenant_id nullable pour tâche globale, source, goal, status, priority, risk, deadline, idempotency_key, plan_version, created_at, updated_at.
- `nexus_task_steps`: task_id, step_id, agent_id, dependency_ids, status, input_ref, output_ref, policy_decision, attempts, budget, timestamps.
- `nexus_agents`: agent_id, version, capabilities_json, allowed_tools_json, scopes_json, budget_json, enabled, health.
- `nexus_policies`: version, rules_json, effective_from, status, author, approval_ref.
- `nexus_approvals`: action_hash, task_id, approver_id, decision, reason, expires_at, consumed_at.
- `nexus_events`: append-only event, tenant scope, correlation_id, actor, action, resource, result, evidence_ref, policy_version, timestamp.
- `nexus_incidents`: severity, domain, detected_by, state, mitigation, owner, resolution evidence.
- `nexus_metrics`: bounded metric definitions and aggregate snapshots.

Toutes les migrations doivent être testées sur une base isolée; aucune migration distante Preview partagée avant sauvegarde/restauration et validation d'identité de base.

## 7. Écrans Nexus Supra

- Centre de contrôle : état global, incidents, tâches en cours, alertes, disponibilité des agents.
- Mission/plan : objectifs, étapes, dépendances, preuve, coût, risque, approbation.
- Agents : capabilities, santé, scopes, budget, pause/reprise.
- Décisions : recommandations, actions exécutées, refus, escalades, validations humaines.
- Risques : sécurité, opérationnel, financier, légal, marché, qualité.
- KPI : demandes, conversion, délai de matching, SLA, satisfaction, qualité, marge simulée, coûts IA, taux d'erreur.
- Gouvernance : politiques, approbateurs, audit, rétention, kill switch.
- Marchés : matrice pays, preuves, status `NOT_ASSESSED`, interdiction d'activation sans approbation.

## 8. SLO et disponibilité cible

Cibles à mesurer (non garanties avant tests) :
- disponibilité orchestration API 99.9% cible; jobs récupérables après interruption.
- aucune tâche critique perdue : outbox + queue durable + déduplication.
- tâche bloquée détectée via heartbeat/timeout.
- reprise contrôlée, DLQ et runbook.
- budgets et limites d'exécution; alertes de coût.
- sauvegarde, restauration et exercices périodiques avec RPO/RTO définis par les responsables.

## 9. Plan de livraison

**Phase A — Safety foundations:** schemas, policy engine, audit events, task state machine, idempotency, kill switch, tests tenant/security.  
**Phase B — Orchestration MVP:** plan JSON, queue, worker, task UI, retries, verification, escalation.  
**Phase C — Agent registry:** 3 agents read-only initiaux (Engineering audit, Ops analytics, Support triage); outils contrôlés, scopes restreints.  
**Phase D — Approved execution:** actions de code/Preview, support draft, notifications non sensibles, budgets et approbations.  
**Phase E — Multi-domain:** matching/planning, provider/customer/company workflows, finance simulation, country readiness.  
**Phase F — Resilience:** observability, SLO, backup/restore, incident simulation, security tests, load tests.  
**Phase G — Human readiness gates:** revue sécurité, RGPD, DPO/juristes, finance/comptabilité, experts pays, support/ops. Production reste NO-GO jusqu'à preuves et autorisations.

## 10. Definition of Done — Nexus Supra

- State machine et policies testées.
- Chaque tool/action possède permission, validation et audit.
- Un agent ne peut accéder à un autre tenant ni environnement.
- Les tâches survivent aux redémarrages et se reprennent sans double action.
- Retries bornés, DLQ, timeouts, budgets et kill switches testés.
- Les approbations ne sont pas contournables et expirent.
- Prompt injection et sorties malformées sont neutralisées.
- Dashboards affichent état réel et preuves, jamais faux statut.
- SLO, coûts, incidents, backups et restore documentés et testés.
- Fonctionnement continu démontré par tests de chaos et exercices.
- Toutes les actions risquées restent sous validation humaine.
- Aucun statut GO FINAL sans preuve end-to-end et validation humaine formelle.

## 11. Priorités de construction immédiates

1. Résoudre le pipeline Preview actuellement bloqué avant d'empiler d'autres fonctionnalités frontend.
2. Stabiliser l'environnement de test et obtenir des tests exécutés avec logs fiables.
3. Implémenter task state machine + audit events + policy/approval model dans API.
4. Créer tests de permissions, idempotence, retries et isolation tenant.
5. Ajouter le premier dashboard Nexus (état réel, tâches, incidents, approbations).
6. Construire progressivement les agents read-only, puis les actions Preview autorisées.


## 12. Production LIVE — réclamations, incidents et supervision bout en bout

### Live operations control room
- Vue temps réel des demandes, prestations planifiées/en cours/terminées, retards, annulations, intervenants indisponibles, capacité par zone et alertes de service.
- Event stream (SSE/WebSocket selon contraintes) avec reconnect, heartbeat, backpressure, déduplication et accès tenant-scoped.
- Historique immutable des changements de statut, acteur, timestamps, reason codes, preuves, correlation IDs et notifications.
- Détection : absence de confirmation, retard, no-show, conflit horaire, durée dépassée, incident, urgence et récurrence.
- Alertes graduées, routage, accusé réception, escalade SLA et astreinte. Aucun service d'urgence médicale/sécurité n'est promis.
- Actions autorisées : confirmation, notifications, ouverture incident, proposition replanification, assignation support, remboursement simulé. Actions engageantes soumises à approbation.

### Réclamations et litiges
- Formulaire multi-catégories : qualité, retard, absence, facturation, sécurité, dommage, comportement, accessibilité ou autre; priorité, chronologie, pièces sécurisées et consentements.
- Case management avec états OPEN, ACKNOWLEDGED, TRIAGED, INVESTIGATING, WAITING_CUSTOMER/PROVIDER, PROPOSED_RESOLUTION, RESOLVED, CLOSED, REOPENED et ESCALATED; SLA pause/reprise explicites.
- Accusé réception, responsable, délai cible, communication centralisée, notes internes séparées, minimisation PII et accès strict.
- Nexus résume factuellement, détecte doublons/risques/récurrences, propose solutions et rassemble preuves; pas de décision autonome de culpabilité, sanction, remboursement, résiliation, assurance ou conclusion juridique.
- Médiation/escalade, contestation, historique contradictoire, revue humaine et audit.
- Analyse tendances par service, zone, entreprise/prestataire, motif et période; seuils prudents, biais contrôlés, pas de scoring opaque excluant automatiquement.
- Dashboard dossiers/SLA, file priorisée, templates, timeline, pièces, approvals, satisfaction, root-cause et actions correctives.

### Incident response
- Lifecycle, severity, owner, impact, runbook, timeline, containment préapprouvé, status updates, recovery evidence, postmortem et tâches de prévention.
- Nexus exécute uniquement mitigations préapprouvées et réversibles dans scope; rollback/production requiert approbation et permissions.

## 13. Portail Client — outils essentiels
- Recherche par besoin, zone, disponibilité, budget, compétences, contraintes, accessibilité et qualité.
- Demande guidée, brouillon, clarifications, pièces minimisées, calendrier/fuseau, durée et fenêtres flexibles.
- Estimation transparente, devis comparables, critères, frais et annulation clairs; non engageant jusqu'à confirmation.
- Matching explicable, contraintes satisfaites, limites, choix et consentement; aucun faux badge de vérification.
- Messagerie liée à prestation, pièces contrôlées, appels/visio si intégration validée et consentement.
- Suivi des statuts, confirmation, ETA seulement si réelle, notifications réglables, calendrier, replanification/annulation selon règles.
- Historique, documents, facture, paiements seulement PSP validé; aucun stockage de données carte.
- Favoris, rebooking, préférences, support, réclamation, feedback, accessibilité, langues, privacy center, export/suppression selon obligations.
- UX mobile-first, onboarding progressif, guest-to-account, aide, anti-fraude, consentement, WCAG, faible bande passante.

## 14. Portail Intervenant — outils métier
- Inscription progressive, vérification identité par prestataire adapté, qualifications/certificats avec expiration et état vérifié clair.
- Profil, compétences, services, rayon, mobilité, langues, tarifs/règles, équipements et contraintes.
- Disponibilités, calendrier, absences, buffers, limites charge, fuseau, anti-double-booking.
- Missions : aperçu données minimisées, conditions, prix, zone, durée, exigences; accept/refus, expiration, motifs non discriminatoires.
- Agenda, navigation via intégration autorisée, check-in/out avec consentement, suivi mission, checklist, messages, preuves limitées.
- Sécurité sur site : signal incident, aide et consignes; ne remplace pas les services d'urgence.
- Qualité : feedback, contestation, coaching, correction, historique équitable.
- Revenus simulés, commissions transparentes, factures/exports; payout après PSP et validation.
- Formation, checklist onboarding, support, notifications, pause activité, confidentialité, export/suppression.

## 15. Live communications & notifications
- Préférences/consentement par canal, templates localisés, transactional vs marketing, quiet hours, opt-out et redaction PII.
- Outbox transactionnelle, idempotence, retries bornés, failover, receipts, bounce/suppression et DLQ.
- Notifications confirmations, statuts, messages, échéances, incidents/réclamations sans divulgation inter-tenant.
- État temps réel autoritatif côté serveur; UI signale stale/offline/reconnect et ne fabrique jamais ETA/position.

## 16. Innovation et veille marché
- Nexus Market Intelligence utilise sources publiques/licenciées et signaux autorisés : feedback agrégé, tendances, évolutions produits/concurrents, réglementation, innovations, saisonnalité et niches.
- Registre source/date/confiance/biais/territoire/droits; provenance/citations.
- Veille par marché et catégorie : besoins non satisfaits, différenciation, menaces/opportunités.
- Pipeline signal → insight → hypothèse → impact/effort/risque → prototype Preview → test contrôlé/consentement → métriques → décision → roadmap.
- Idées : matching explicable, prévision disponibilités, optimisation trajet/buffers sans tracking excessif, prévention no-show, onboarding adaptatif, devis transparent, accessibilité, parcours multi-services, continuité, outils pro et support augmenté.
- Pas d'espionnage, scraping interdit, collecte excessive, manipulation, faux avis, dark patterns, discrimination ni promesse concurrentielle non démontrée.
- Experiments registry : hypothèse, segment, metrics, guardrails, période, consentement, rollback et résultats; revue humaine si risque.

## 17. GitHub + Cloudflare continuous engineering loop
- Connecteurs scoped read-only par défaut pour repos, branches, PR, commits, CI, issues, releases et configurations Cloudflare autorisées.
- Nexus surveille changements, CI, erreurs, drift, builds Preview, budgets, métriques et sécurité; crée tâches et propositions PR.
- Agent Engineering peut créer branches/commits/PR dans scopes explicitement autorisés; tests, logs, changelog, risques et rollback requis.
- Review et checks obligatoires; aucune auto-merge, Production deploy ou modification de secrets/bindings sensibles.
- Cloudflare read-only initialement; Preview vérifié par identité ressource, environnement et binding DB. Mutations uniquement permission explicite + approval.
- Veille dépendances/vulnérabilités/coûts/migrations/compatibilité; patch en PR, jamais appliqué directement.
- Connecteur indisponible = UNKNOWN/STALE, retries limités et alerte, jamais « sain » par défaut.

## 18. Developer handoff — prêt à développer
- PRD/user stories/acceptance criteria, journeys et edge cases.
- Architecture/domain boundaries, diagrammes, API OpenAPI, event schemas, modèle de données et migrations.
- Design tokens, composants, accessibilité, breakpoints, états empty/loading/error/offline.
- Backlog trié, dépendances, issue/PR templates, definition-of-done et risk register.
- Tests unit/integration/API contract/E2E/accessibility/performance/isolation/security/resilience/localization/DST/notifications/reclamation SLA/live reconnect.
- Matrice environnements dev/test/Preview/staging/production; données synthétiques isolées; secrets et permissions.
- Runbooks deployment/rollback, incidents, backups/restore, queues/DLQ, support, PSP outages, droits data et activation pays.
- Evidence pack : SHA commit, workflow run, logs, tests, Preview URL, screenshots, limites connues et approvals. Rien n'est DONE sans preuves.
