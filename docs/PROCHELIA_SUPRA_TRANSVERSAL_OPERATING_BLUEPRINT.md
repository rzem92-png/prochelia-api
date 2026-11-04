# PROCHÉLIA — SUPRA Operating System & Product Blueprint (préproduction)

**Statut:** spécification, pas une implémentation ni une certification. Branche de travail uniquement. Aucun merge, migration D1, déploiement production, paiement réel ou activation de pays sans autorisation explicite.

## Mission
Créer une marketplace de services de proximité complète, accessible sur téléphone, tablette et ordinateur, où SUPRA coordonne l'expérience client, intervenant et gestionnaire. L'IA suggère et automatise les tâches à faible risque; les autorisations et effets réels sont contrôlés par le serveur, des politiques déterministes et des permissions humaines.

## 1. Applications et expérience multi-supports
- PWA responsive/mobile-first, installation facultative, utilisable sur iOS/Android, tablette et desktop; prévoir tests Safari iOS, Chrome Android, Firefox/Chrome/Safari desktop.
- Design system accessible: WCAG 2.2 AA cible, contraste, clavier, lecteur d'écran, tailles de texte, langage simple, RTL, faible bande passante et parcours sans GPS.
- Internationalisation: locale, langue, devise, formats date/heure/nombre, timezone IANA, traduction validée et contenu original conservé.
- Offline limité: cache shell et données non sensibles nécessaires; opérations critiques mises en file, idempotentes, avec synchronisation explicite et signalement de conflit. Ne pas stocker localement tokens/secrets ou données sensibles sans nécessité et protection.
- Authentification sécurisée, MFA/OTP selon risque, sessions révocables, récupération de compte, rate limit, détection abus, protection CSRF/XSS/SQLi, CSP, secrets et cookies sécurisés.

## 2. Espaces utilisateurs
### Client
- découverte prestations, disponibilité, prix transparent, profil intervenant, réservation, modification/annulation, paiement PSP, reçus/factures, messages, suivi mission, preuve, réclamation, remboursement, notation modérée, parrainage, fidélité, préférences de langue/accessibilité et gestion des données.

### Intervenant
- inscription, identité et documents vérifiés par source fiable, compétences et services autorisés, disponibilité, devis/prix selon règles applicables, acceptation/refus mission, calendrier, route/ETA facultatif, arrivée/départ QR/PIN, checklists, preuve de réalisation, frais/kilométrage, paiement/revenus, factures, historique, contestation, support, parrainage, formation/sécurité, statut de documents et export de données.
- autonomie réelle et règles contractuelles cohérentes avec le fonctionnement effectif; pas de sanctions automatiques IA.

### Gestionnaire / propriétaire
- dashboard finances (GMV, revenus nets, commissions, coûts PSP, remboursements, CAC, LTV, rétention, marge par prestation/région/canal), missions, qualité, incidents, litiges, risques, documents, pays, campagnes, règles, utilisateurs, rôles, audit, sauvegardes, support et gouvernance.
- séparation des tâches, double validation pour changements critiques, export et journal d'audit.

## 3. Catalogue et matching Nexus
- catalogues versionnés par juridiction et activité; activités réglementées cachées/bloquées tant que prérequis non vérifiés.
- matching par disponibilité, distance approximative, compétences, préférences explicites, prix, fiabilité et équité; éviter discrimination/proxy sensible.
- règles de ranking explicables, auditables, testées contre biais; pas de décisions défavorables exclusivement automatisées.
- moteur de contraintes (temps, chevauchement, capacité, rayon, durée, sécurité, qualifications, frais) avant suggestion IA.
- tests de surcharge, double réservation, indisponibilité, changement d'adresse et remplacement.

## 4. Mission et preuve
- cycle de vie versionné: draft → quote → accepted → scheduled → in_progress → completed/partially_completed/cancelled/disputed.
- transitions uniquement via API autorisée, transaction, contrôle d'état et idempotency key.
- prix, périmètre, date/heure, conditions et modifications confirmés avant exécution.
- QR dynamique/PIN, timestamps serveur, confirmation client/intervenant, checklist, GPS ponctuel facultatif; preuve alternative hors ligne/absence client.
- journal append-only et reçu partageable; corrections ajoutées, pas d'effacement silencieux.
- aucune preuve unique réputée absolue; SUPRA distingue preuve vérifiée, déclaration, hypothèse et incertitude.

## 5. SUPRA AI transversal
### Domaines
- Copilote Client: choix prestation, FAQ, booking et support.
- Copilote Intervenant: planning, documentation, assistance, prévention sécurité, revenus.
- Copilote Gestion: operations, stratégie, finances, qualité, marketing, veille et incidents.
- Copilote Legal/Compliance: sources officielles, règles versionnées, checklist, alertes et pays.
- Copilote Dispute: collecte contradictoire, chronologie, options de résolution et escalade.
- Copilote Growth: segmentation consentie, offres, parrainage, rétention, tests A/B et budget.
- Copilote Product/Tech: anomalie, tests, logs autorisés, suggestions de patch, CI et rapport.

### Architecture obligatoire
LLM → validation schéma/type → policy engine déterministe → authorization/RBAC/tenant → approbation requise selon action → action API idempotente → vérification résultat → audit.
- outils allowlistés et scopes minimaux; jamais d'accès arbitraire DB/secrets/production.
- prompt injection défense, validation d'inputs, provenance, citations et redaction PII.
- AI peut proposer; les actions de paiement, contrat, tarif sensible, sanctions, suspension, sécurité, droit RGPD, litige, pays et production nécessitent décision humaine.
- approbation liée au payload/hash exact, expiration, révocation et anti-replay.
- réponse de secours si IA indisponible: opérations essentielles restent accessibles via workflows déterministes.

## 6. Conflits, réclamations et médiation
- case ID, catégorie, priorité, SLA, parties, preuves minimales, versions contradictoires, chronologie, communications et recours.
- scénarios: absent, retard, annulation, mission partielle, prestation non conforme, dommage, comportement inapproprié, sécurité, discrimination, frais, temps, kilométrage, prix, paiement, double charge, refund, chargeback, QR/GPS incohérent, panne, traduction, fraude présumée.
- SUPRA propose étapes/options et détecte incohérences; aucune accusation automatique ou verdict final.
- urgence/safety: support humain prioritaire, consignes de sécurité et contact services d'urgence locaux lorsque pertinent.
- séparation médiation et décision financière; historique et notification de chaque partie.

## 7. Paiements et finances
- PSP marketplace approprié; PROCHÉLIA ne conserve pas les numéros de carte.
- autorisation/capture, commission, frais, payout, refund, chargeback, réconciliation, ledger append-only, idempotence et gestion webhook dupliqué/désordonné.
- test sandbox seulement; paiements/réserves/payouts réels désactivés avant approbation.
- fonds et responsabilités ne sont pas supposés être détenus par PROCHÉLIA; architecture conforme au rôle contractuel/PSP.
- facturation adaptée au rôle de plateforme et aux vendeurs; intégration solution/plateforme agréée quand requise, sans se présenter comme PA sans immatriculation.
- gestion fiscale multi-pays et rapports intervenants; règles confirmées par juridiction.

## 8. Growth, marketing, fidélisation, parrainage
- promotions paramétrables: code, ciblage consentement, dates, limites, plafond, budget, coût par conversion, exclusions et abus.
- parrainage transparent: conditions, attribution, récompense différée si conditions légales/anti-fraude remplies, plafonds, annulation en cas de fraude confirmée, procédure de recours.
- fidélité: points/crédits/avantages avec expiration et conditions explicites, comptabilité des obligations, limites de coûts et tests de rentabilité.
- CRM et campagnes: opt-in/opt-out, préférences, suppression, fréquence limitée, anti-spam, consentement canal et segmentation non sensible.
- offres personnalisées sans discrimination; prix transparents, pas de dark patterns, pas de fausse urgence.
- tests A/B, holdout, mesure incremental lift, CAC, LTV, repeat booking, contribution margin, churn, refunds, complaints et provider earnings.
- plafonds budget, seuils de marge et kill switch automatique pour campagne; SUPRA recommande, gestionnaire approuve budget/conditions.
- plan anti-fraude parrainage: comptes multiples, device/IP signaux proportionnés, referral loops, auto-parrainage, paiements/chargebacks; pas de blocage irréversible sur un score seul.

## 9. Profitabilité durable
- unité économique par mission, service, zone, canal et cohortes: prix payé, commission, PSP, assurance, support, remboursements, promotion, impôts, coûts cloud/IA, contribution margin.
- scénarios pessimiste/base/optimiste, seuil rentabilité, trésorerie, saisonnalité, coûts fixes/variables et runway.
- équilibrer marge PROCHÉLIA, revenu intervenant et valeur client; éviter promotions qui rendent la mission déficitaire.
- stratégie de crise: services essentiels, coûts adaptatifs, backup PSP/cloud, zones pilotes, budget marketing flexible, fonds de réserve, churn prevention.
- SUPRA produit recommandations sourcées, scénarios et incertitudes; propriétaire approuve décisions de prix, commission, dépenses et changements économiques majeurs.

## 10. Sécurité et privacy
- tenant isolation, RBAC, least privilege, MFA, audit, encryption, key rotation, secrets manager, rate limiting, anti-abuse, CSP, validation, upload scanning, secure headers.
- données séparées par sensibilité: identité, paiement, GPS, mission, santé/sensibilité; aucune collecte de santé sans nécessité et base légale.
- retention schedule, export/rectification/effacement, legal hold limité, backup purge policy, privacy requests workflow.
- incident response: détection, containment, évaluation, notification selon délais applicables, communication, postmortem et corrective action.
- backups chiffrés, restore tests, RPO/RTO, DR, failover et rollback.
- logs: redaction, retention, access; données pseudonymisées restent personnelles.
- pentest/DAST/SAST/SCA, secrets scan, dependency pinning, CI, threat model, abuse cases et test cross-tenant.

## 11. Legal Shield / international
- country registry: research → preproduction → review → active par approbation humaine → suspended.
- sources officielles datées/versionnées, règles d'effet, liens et confiance; aucune citation juridique sans provenance.
- pays, région, service et rôle: fiscalité, droit du travail, plateforme, consommateur, privacy, paiement, signature, assurance, services réglementés, sanctions et transferts.
- changement légal: alerte, impact assessment, proposition, tests, approbation, version et rollback.
- AI-generated legal docs = drafts; version originale et traductions conservées; review workflow.
- France 2026+ : facturation électronique (réception 1 Sept 2026 pour toutes les entreprises concernées; émission par catégories selon calendrier), DAC7/DPI et possible social platform withholding dès 2027 selon champ d'application. Le système doit vérifier ces obligations depuis les sources officielles et le modèle exact; ne pas coder les obligations comme universelles.
- SUPRA ne garantit jamais conformité absolue et ne remplace pas une autorité.

## 12. Support, observabilité et gouvernance
- support ticket, SLA, triage, escalation, incident, refund review, user feedback, status page.
- observabilité: logs structurés redacted, metrics, traces, error budget, uptime, alertes, dashboards.
- feature flags, release channels, migrations versionnées/rollback, staging gates, changelog et validation propriétaire.
- environnement local/dev/staging/prod séparés, données synthétiques en préproduction, no production secrets.
- audit trails et evidence pack pour chaque release; CI result tied to exact commit.

## 13. Test matrix end-to-end
- unit, integration, contract, E2E, load, accessibility, mobile browsers, offline, localization, security and regression.
- duplicate request/webhook, race booking, refund concurrency, retry, crash/recovery, D1 missing schema fail-closed, cross-tenant, session revoke, account takeover, forged GPS/QR, client absent, partial service, disputes, AI hallucination/prompt injection, country gate bypass, expired legal rule, marketing consent withdrawal, referral abuse, campaign loss budget, PSP outage, backup restore, data deletion and rollback.
- tests use synthetic accounts/data; no real money.

## 14. Release gates
- CI green for exact SHA, reviewed diff, no critical/high unmitigated vulnerability.
- integration/E2E, access-control, tenant isolation, backup/restore and incident playbooks verified.
- payment sandbox, ledger/reconciliation, invoice/legal rule gates verified.
- country/service rules and human approval documented.
- production deployment requires explicit owner approval; rollback and monitoring ready.
- NO-GO for critical test failure, uncertain service legality, missing authorization, unsafe AI action, untested restore, missing privacy notice or payment reconciliation gap.

## 15. Deliverable status
This blueprint is a product/system specification only. It does not claim that all modules are implemented, tested, compliant, profitable or production-ready. Implement incrementally in preproduction and report each commit, CI result, tests and remaining blockers honestly.