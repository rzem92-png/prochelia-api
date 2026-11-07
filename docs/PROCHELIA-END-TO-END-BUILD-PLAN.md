# PROCHÉLIA — plan de construction intégrale et recette de lancement

**Version:** 1.0 — 2026-11-07  
**Branche:** `preprod/r2-eu-binding-isolated-2026-11-07`  
**Nature:** spécification d'exécution et critères de recette; ne constitue pas une validation production.

## Principes non négociables
- Préproduction isolée; aucun changement production, DNS, paiement réel, migration D1 destructive ou merge sans validation distincte.
- Une fonctionnalité n'est PASS qu'avec une preuve reproductible (test, capture/log expurgé, version, date, environnement).
- Fail-closed sur authentification, permissions, propriété des ressources, paiement, prix, identité et documents.
- Les actions juridiques, financières, contractuelles, de santé/sécurité et décisions défavorables automatisées requièrent une validation humaine.
- Aucune donnée sensible, token, clé ou donnée patient/client réelle dans les logs, tickets ou jeux de test.

## Périmètre fonctionnel à terminer

### Client
- Inscription, connexion, vérification email/téléphone si activée, récupération, consentements versionnés, export et suppression/anonymisation.
- Catalogue, détail service, zones, disponibilité, estimation transparente, frais et majorations avant confirmation.
- Réservation, confirmation, annulation/report, notifications, facture/reçu, historique, avis après mission, réclamation et support.
- Parcours invité autorisé uniquement si les données minimales, consentements, anti-abus et confirmation sont conçus; conversion en compte sans doublons.
- Service urgence/soin médical réglementé clairement exclu ou orienté vers ressources adaptées; pas de promesse de soin médical.

### Intervenant
- Création profil, identité et documents vérifiés par statut (ne jamais afficher les documents).
- Compétences, zones, disponibilités, tarifs/conditions validés, visibilité publique limitée au prénom et informations strictement nécessaires.
- Accepter/refuser mission, détails uniquement après autorisation, check-in/out QR ou preuve équivalente, durée, déplacement si prévu, incident, facture et suivi paiement.
- GPS limité à une mission active, permission explicite, durée limitée, accès restreint et journalisation; pas de suivi permanent.
- Statut indépendant à vérifier juridiquement; aucune présentation trompeuse comme salarié ou garantie d'activité.

### Gérante / Administration
- RBAC least privilege et séparation des fonctions; revue de rôle à chaque requête.
- Gestion catalogue, zones, tarifs, règles de commission, intervenants, documents, réclamations, promotions et incidents.
- Audit immuable des opérations sensibles, sans secrets/PII excessives.
- Actions Copilote à impact faible et réversible seulement sous politique autorisée; approbation avant changement de prix, contrat, paiement, remboursement, suppression, suspension ou action juridique.
- Tableau de bord avec métriques vérifiables, alertes, rapprochement et export.

### Nexus — matching
- Score explicable à partir de disponibilité, zone/distance, compétences vérifiées, qualité, prix et préférences explicites.
- Exclure les attributs sensibles et leurs proxys; revue anti-discrimination et possibilité de contestation.
- Pas de promesse d'« algorithme inimitable »; propriété intellectuelle et performance doivent être mesurées.
- Recommandation, pas décision automatique à effet important; journaliser facteurs utiles, pas de données sensibles.

### Paiement / Stripe
- Sandbox uniquement tant que le GO humain production n'est pas signé.
- Modèle de montant calculé côté serveur; devis figé (snapshot), devise, taxes/TVA, frais, commission, revenu intervenant, politique d'annulation.
- Idempotence par opération, webhook signature/timestamp, traitement rejouable sans doublon, transitions d'état contrôlées.
- Tests charge, double clic, concurrence, timeout, webhook répété/désordonné, remboursement partiel/total, payout, échec et réconciliation.
- Interdire l'exposition de secrets Stripe côté navigateur; ne jamais considérer le retour navigateur comme preuve de paiement.

### Documents, contrats et conformité
- Contrats/CGU/CGV/conditions intervenant, politique d'annulation, responsabilité de plateforme, transparence de mise en relation et règles de facturation revus par conseil compétent.
- Consentements, finalités, minimisation, droits RGPD, durée de conservation, suppression/anonymisation, sous-traitants, registre et procédure de violation.
- Ne pas stocker de données de santé ou de documents d'identité non nécessaires; contrôle d'accès et chiffrement.
- Assurance, obligations de services à la personne, fiscalité, droit du travail/risque de requalification et réglementation française/européenne vérifiés avant commercialisation.
- Belgique / international: déploiement distinct après étude locale, traduction, devise, fiscalité, PSP et conformité; aucune activation par simple traduction.

### Copilote transversal
- Réponses basées sur données/état réel; afficher source, date, confiance et limites.
- Préparer devis, messages, scénarios, opérations et analyses, mais ne pas prétendre envoyer, payer, signer, supprimer ou modifier sans outil et confirmation.
- Automatisation de tâches à faible risque, journalisée, réversible; validation humaine pour toute action sensible.
- Anti-hallucination: pas d'invention de disponibilité, paiement, identité vérifiée, conformité, métrique ou contact.

### Commercial, recrutement et rentabilité
- CRM B2B/B2C/intervenants avec consentement et source licite; pas de scraping/relance abusive.
- KPI: conversion demande→réservation, délai de matching, taux d'acceptation, annulation/no-show, récurrence, satisfaction, marge contributive par mission, CAC, LTV, coût support, incidents.
- Tarifs simulés: prix client = coût service + frais transparents; commission et net intervenant affichés avant engagement; frais PSP, TVA, assurance, support, remboursement et acquisition inclus dans la marge.
- Promotion seulement si marge plancher et budget sont calculés; validation gérante obligatoire.
- Parrainage avec règles antifraude, plafond, conditions claires et suivi de coût.

## Architecture / qualité
- Frontend responsive/PWA (iOS Safari, Android Chrome, tablette, desktop), accessibilité, états chargement/vide/erreur/offline.
- API HTTPS, CORS précis, sessions secure HttpOnly, SameSite adapté, CSRF token validé pour mutations cookie-auth, CSP, rate limiting, validation entrée, erreurs non bavardes.
- D1: contraintes, index, migrations versionnées et testées; backup avant migration; migrations seulement après approbation.
- R2 privé UE, accès minimal, URLs signées courtes si besoin, chiffrement, antivirus/validation MIME et taille, rétention, audit, test restauration.
- Observabilité: health/readiness, logs structurés expurgés, métriques, alertes, corrélation, statut incident et rollback.
- CI: lint, tests unitaires, tests API intégration, tests sécurité, tests e2e, build frontend/backend, artefacts de preuve.
- Versions distinctes dev/staging/preprod/prod, secrets distincts, aucun secret dans repository, bundle ou logs.

## Gates de recette bloquants
| Gate | Test requis | Statut par défaut |
|---|---|---|
| G0 | inventaire code, secrets, routes, tables, intégrations | BLOCKED until evidence |
| G1 | login/logout/session expiry, CORS credential, CSRF token absent/incorrect/correct, Origin spoof | BLOCKED |
| G2 | RBAC, ownership, tenant isolation, IDOR, privilege escalation | BLOCKED |
| G3 | parcours client réservation/annulation/support | BLOCKED |
| G4 | parcours intervenant vérification/acceptation/check-in/out | BLOCKED |
| G5 | parcours gérante, audit, rôles, support | BLOCKED |
| G6 | prix serveur, commissions, arrondis, annulation, idempotence | BLOCKED |
| G7 | Stripe sandbox: paiement/refund/payout/webhook concurrency/reconciliation | BLOCKED |
| G8 | R2 upload/download/delete, accès non autorisé, checksum, rotation secret | BLOCKED |
| G9 | backup + restauration mesurée RPO/RTO et intégrité | BLOCKED |
| G10 | RGPD, juridique, assurance, fiscalité et contrats revus | BLOCKED |
| G11 | charge, accessibilité, compatibilité appareils, incident/rollback | BLOCKED |
| G12 | approbation écrite humaine et fenêtre de lancement | BLOCKED |

## Definition of Done (production)
GO uniquement si chaque gate est PASS avec artefact attaché, aucun risque critique/haut non accepté, secrets rotés, restauration prouvée, monitoring et rollback opérationnels, conformité revue, et approbation explicite de la Gérante. Une configuration « ready » ou une route API ne suffit pas.
