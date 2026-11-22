# PROCHÉLIA — Comptabilité générale et grand livre en partie double

**Statut :** module candidat, non déployé. Cette version fournit le noyau du grand livre tenant-scoped. Elle ne constitue ni un logiciel comptable certifié ni une validation fiscale ou comptable.

## Périmètre livré par le candidat

- Entités comptables rattachées à un tenant.
- Plan de comptes : code, libellé, classe, sens normal et état actif.
- Journaux en brouillon, lignes débit/crédit en centimes, devise unique par entité.
- Contrôle de l'équilibre avant création et par les triggers D1 lors de la comptabilisation.
- Clés d'idempotence pour les entités, comptes et journaux.
- Séparation des tâches : l'auteur d'un journal ne peut pas le comptabiliser lui-même.
- Contrepassation exacte d'un journal comptabilisé, créée en brouillon puis soumise à une comptabilisation séparée.
- Balance de vérification par compte et total débit/crédit.
- Autorisation dérivée du tenant actif en session ; aucun tenant transmis par le navigateur n'est utilisé comme autorité.

## Routes candidates

| Méthode | Route | Usage |
|---|---|---|
| GET | `/api/accounting/health` | Vérifie que les quatre tables canoniques sont migrées |
| GET / POST | `/api/accounting/entities` | Liste / crée une entité comptable |
| GET / POST | `/api/accounting/accounts` | Liste / crée les comptes |
| GET / POST | `/api/accounting/journals` | Liste / crée des journaux en brouillon |
| GET | `/api/accounting/journals/:id` | Détail d'un journal et de ses lignes |
| POST | `/api/accounting/journals/:id/post` | Comptabilise avec contrôle de séparation des tâches |
| POST | `/api/accounting/journals/:id/reverse` | Crée une contrepassation en brouillon |
| GET | `/api/accounting/trial-balance` | Balance de vérification à une date donnée |

## Contrôles et limites

- Les écritures sont exprimées en centimes entiers ; aucun flottant monétaire.
- Une entité ne peut comptabiliser que dans sa devise de base. Les opérations en devise étrangère restent bloquées jusqu'à un module FX approuvé avec taux, date, source et comptes de conversion.
- Les journaux POSTED et leurs lignes sont protégés par les triggers de la migration 0023 ; la migration 0040 vérifie que l'entité et les comptes sont actifs à la comptabilisation.
- Le service ne déplace pas d'argent, ne déclenche aucun PSP, ne génère pas de facture fiscale et ne calcule pas la TVA.
- Les rôles FINANCE peuvent préparer les journaux ; OWNER/ADMIN peuvent comptabiliser ; l'auteur d'un journal ne peut pas être son propre comptabilisateur.
- Les entités comptables créées ici sont des objets de tenue de livres, pas une preuve d'immatriculation, de mandat, de statut fiscal ou d'autorisation professionnelle.

## Modules encore à construire avant de parler de comptabilité complète

1. Facturation client et entreprise, numérotation légale et avoirs.
2. Dépenses, justificatifs, notes de frais et immobilisations.
3. TVA française et taxes algériennes selon la qualification locale, les régimes, seuils et dates applicables.
4. Rapprochement PSP, banques et caisse ; import de relevés et détection de doublons.
5. Commissions, remboursements, frais PSP et versements, liés à des événements PSP vérifiés.
6. Comptes de tiers, lettrage clients/fournisseurs et échéanciers.
7. Périodes, clôtures, verrouillage, réouverture contrôlée et piste d'audit.
8. Exports et états comptables/fiscaux validés par expert-comptable et conseil local.
9. Packs pays France/Algérie avec plan de comptes, devise, taxes, factures et règles d'archivage versionnés.

## Conditions de recette

- Appliquer les migrations 0023 et 0040 uniquement sur une copie D1 Preview après sauvegarde restaurable.
- Tests E2E multi-tenant : un tenant ne peut ni lire, ni modifier, ni comptabiliser les journaux d'un autre.
- Tests de concurrence sur idempotence et comptabilisation.
- Tests de contrepassation exacte, désactivation de compte après brouillon, inactivation d'entité et échec des triggers.
- Revue par expert-comptable France et conseil fiscal/comptable Algérie avant activation métier.
