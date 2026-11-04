# PROCHÉLIA — Comptabilité & déclarations de la Gérante (consolidation)

Version : 1.0 — 2026-11-04  
Statut : spécification de consolidation / préproduction. Ce document ne certifie ni la comptabilité ni les déclarations fiscales.

## Objectif
Consolider la page comptable de PROCHÉLIA en un centre de pilotage de la Gérante : chiffres fiables, traçables, exportables, rapprochement bancaire et préparation des dossiers pour l'expert-comptable. Réutiliser les composants finance existants dans `src/index.js`; ne pas créer de deuxième ledger ni de deuxième dashboard parallèle.

## État technique observé
Le backend existant comporte notamment :
- `/api/finance/dashboard`, `/api/finance/export`, `/api/finance/entry`, `/api/finance/problem`, `/api/finance/problem/resolve`;
- `finance_workspace_entries`, `finance_export_log`, `finance_resolution_cases`;
- agrégats sur `payment_transactions` (gross, commission, frais PSP, remboursements, net intervenant);
- export CSV, JSON et HTML imprimable (le format `pdf` est actuellement un HTML à imprimer, pas un PDF généré nativement);
- finance forecast et accounting ledger existants ailleurs dans le même fichier.

Important : ce sont des composants backend. La présence de ces routes ne prouve pas que l'interface complète est reliée, testée, ni déployée. Le code de synthèse actuel ne constitue pas un grand livre comptable certifié.

## Règle d'architecture — une seule source de vérité
1. Réutiliser le ledger et les routes existants après audit de leur schéma et de leur usage.
2. Éviter la duplication de tables, endpoints, calculs de commission ou journaux.
3. Montants stockés en centimes entiers et devise ISO-4217; pas de flottants pour les écritures.
4. Les écritures comptables confirmées sont append-only/corrigées par contre-écriture, pas par modification destructive.
5. Distinguer date d'opération, date de valeur, date de comptabilisation, statut, période et devise.
6. Traçabilité complète : auteur, source, identifiant externe, idempotency key, date, motif, référence mission/paiement/facture et historique.
7. Séparation stricte Gérante/Finance/Admin, intervenant, client et support; clients/intervenants ne voient que leurs données personnelles. Support sans accès libre aux montants sensibles.
8. Aucune opération bancaire ni écriture financière ne doit être exécutée automatiquement par Copilote sans autorisation explicite et audit.

## Modules de l'écran comptable Gérante
### Tableau de bord
- filtres période (jour, mois, trimestre, année, dates personnalisées), statut, canal B2C/B2B, provider et devise;
- CA brut facturé, encaissements réels, remboursements/avoirs, commissions acquises, frais PSP, reversements intervenants, marge plateforme estimée, charges, résultat estimé et trésorerie;
- comparaison périodes, évolution, prévisions avec indication « estimation »;
- séparation des sommes en attente, bloquées, disputées, annulées et réellement réglées.

### Journaux et pièces
- journal ventes/commissions, achats/charges, banque, PSP, remboursements, reversements, frais et écritures de régularisation;
- import et rattachement de factures/reçus, catégories, fournisseur, date, HT/TVA/TTC, devise, moyen de paiement, notes;
- détection de doublons, pièces manquantes, écarts et écritures orphelines;
- correction par contre-écriture avec motif et validation.

### Fiscalité / déclarations (France)
- paramétrage contrôlé du régime fiscal et du régime TVA de l'entreprise (ne pas présumer franchise en base, taux ou régime);
- ventilation HT, TVA collectée, TVA déductible, TVA non applicable/exonérée et TTC selon règles validées;
- calendrier configurable des échéances et alertes;
- exports préparatoires par période pour expert-comptable : journaux, grand livre, balance, ventes, achats, TVA, commissions, relevés PSP, rapprochement;
- affichage permanent « préparation/estimation — à valider par professionnel » tant que règles fiscales et données ne sont pas validées.
- ne pas envoyer de déclaration fiscale ni la présenter comme déposée automatiquement.

### Rapprochement bancaire / Boursorama
- connecteur bancaire interchangeable via interface provider-agnostic; BoursoBank/Boursorama initial, fournisseur d'agrégation à sélectionner après vérification du contrat, sandbox, tarifs et conformité;
- import CSV manuel disponible comme secours;
- ne jamais demander ni stocker les identifiants bancaires. Authentification chez la banque/agrégateur, consentement révocable, journaux d'accès, minimisation et politique de conservation;
- rapprocher mouvements bancaires, transactions Stripe/PSP, factures, remboursements et reversements; suggestions de rapprochement, jamais de rapprochement forcé;
- séparation Open Banking (lecture de comptes) et Stripe marketplace (encaissement des prestations). Ne pas activer l'initiation de paiement sans analyse juridique et habilitations appropriées.

### Exports
- CSV UTF-8 compatible Excel français (séparateur configurable ;/ ,), JSON, HTML imprimable et PDF réel via génération PDF sécurisée;
- période, fuseau, devise, totaux et nombre de lignes; métadonnées de génération;
- export expert-comptable en archive structurée avec manifeste et pièces justificatives autorisées;
- journaliser exportateur, période, format, horodatage et filtre sans exposer données sensibles dans les logs.

## Sécurité et fiabilité
- authentification obligatoire, RBAC et tests d'accès par rôle;
- tenant/user scope strict pour clients et intervenants; filtrage admin/finance explicite;
- validations d'entrées, limites de pagination/volume, anti-injection CSV (neutraliser formules Excel commençant par =, +, -, @);
- idempotence des imports et webhooks, détection doublons, transactionnalité et verrouillage/concurrence;
- aucune suppression d'écriture confirmée; correction auditable;
- données bancaires et justificatifs protégés, chiffrement, accès minimum, logs sans IBAN complet ni données sensibles;
- backup/restore, contrôle d'intégrité et rétention RGPD configurables;
- montants et calculs vérifiés par tests indépendants, réconciliation systématique des totaux.

## Tests à exiger avant validation experte
1. Unit tests des calculs : refunds partiels/total, frais PSP, commissions, TVA, arrondis, devise et prorata.
2. Property/invariant tests : ledger balance, idempotence, pas de double comptabilisation, total débit/crédit, monotonicité des remboursements.
3. Tests API par rôles et isolation de données (client/intervenant/Gérante/finance/admin/support).
4. Tests import CSV: séparateurs, encodage, dates, montants négatifs, lignes dupliquées, formule malveillante, fichier volumineux.
5. Tests de rapprochement: match exact, partiel, ambigu, doublon, mouvement non trouvé et réconciliation manuelle.
6. Tests export : CSV/JSON/PDF, dates, sommes, données masquées, journal d'audit.
7. Tests de concurrence et idempotence sur import, remboursement et écriture corrective.
8. Tests sauvegarde/restauration et intégrité des pièces.
9. Test d'acceptation avec données fictives anonymisées et expert-comptable avant toute déclaration réelle.
10. CI verte sur commit exact, aucune migration D1 ni production sans procédure approuvée, backup, validation et rollback.

## Séquence d'implémentation proposée
A. Audit des routes/tables existantes et des écrans front; établir un mapping unique (pas de duplicata).  
B. Tests de caractérisation sur l'existant; corriger les erreurs de rôle, agrégats et exports.  
C. Compléter dépenses, pièces, factures et journaux; migrations uniquement après review et backup validé.  
D. Rapprochement Stripe/PSP et import CSV Boursorama; sandbox agrégateur ensuite.  
E. Fiscalité paramétrable et exports expert-comptable, revue légale/comptable.  
F. Interface Gérante, tableaux, filtres, drill-down, alertes et accessibilité mobile.  
G. Tests end-to-end, sécurité, restore, CI; préproduction; décision de production par validation humaine.

## Critères de sortie
- aucun chiffre de dashboard sans définition et source;
- somme des détails = total des agrégats (écart zéro ou explicité);
- accès autorisés seulement, données isolées;
- écritures idempotentes, auditables et corrigibles par contre-écriture;
- exports contrôlés et testés;
- test CI vert sur SHA final;
- vérification comptable/fiscale professionnelle et validation humaine avant usage déclaratif réel.
