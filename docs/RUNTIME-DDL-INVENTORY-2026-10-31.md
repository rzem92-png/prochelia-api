# Audit DDL à l'exécution — branche hardening/preview-release-gates-v1

Date de l'audit : 2026-10-31
Fichier audité : `src/index.js` (4 005 lignes au commit audité)
Méthode : inventaire statique des définitions `ensure*Schema` et de leurs références directes dans ce fichier. Ce n'est ni un audit dynamique D1, ni une preuve que tous les appels indirects du dépôt sont couverts.

## Résultat

Dix helpers de schéma sont encore définis dans le Worker. L'inventaire statique compte **67 appels directs** à ces helpers dans `src/index.js` (7 + 9 + 7 + 10 + 12 + 5 + 6 + 1 + 3 + 7). Ils exécutent des `CREATE TABLE`, `CREATE INDEX`, parfois des `CREATE TRIGGER`, et certains insèrent aussi des valeurs par défaut à l'exécution. Ce total ne couvre pas les appels indirects, les autres fichiers ni les comportements effectifs de D1.

| Helper | Définition | Appels directs dans `src/index.js` |
|---|---:|---|
| `ensureSecuritySchema` | 432 | 543, 555, 621, 669, 687, 742, 762 |
| `ensurePaymentSchema` | 774 | 867, 885, 896, 925, 942, 1000, 1111, 1144, 2838 |
| `ensureConsolidatedSchema` | 1325 | 1415, 2051, 2612, 2716, 2838, 2871, 3094 |
| `ensureStrategicSchema` | 2083 | 2225, 2324, 2369, 2381, 2400, 2433, 2634, 2716, 2838, 2871 |
| `ensureOperationalSchema` | 2461 | 1612, 2612, 2634, 2655, 2672, 2682, 2716, 2731, 2763, 2838, 2871, 2893 |
| `ensureFinalHardeningSchema` | 2787 | 2838, 2871, 2885, 2893, 3851 |
| `ensureCommercialRecruitmentSchema` | 2945 | 3046, 3056, 3067, 3074, 3085, 3094 |
| `ensureFinanceWorkspaceSchema` | 3106 | 3167 |
| `ensureNationalContinuitySchema` | 3453 | 3486, 3523, 3529 |
| `ensureProcheliaMasterComplementSchema` | 3616 | 3688, 3697, 3707, 3715, 3758, 3773, 3788 |

## Risques confirmés par le code

1. **DDL dans le chemin des requêtes** : les helpers sont appelés par des handlers de routes. Cela couple disponibilité métier, latence et droits SQL au processus HTTP.
2. **Écriture de configuration au runtime** : certains helpers font aussi des `INSERT OR IGNORE` pour des paramètres, règles ou profils par défaut. Il faudra séparer structure et données de référence.
3. **Initialisation transversale** : les chemins de contrôle final appellent plusieurs helpers successivement. Une seule requête peut donc tenter de préparer de nombreux domaines.
4. **Périmètre sécurité** : le contrôle RBAC ajouté aux routeurs consolidé/opérationnel ne couvre pas automatiquement les autres familles (identité, paiement, commercial, finance, sauvegarde, profils, rate-limit). Chaque route doit être reliée à son contrôle d'accès effectif.
5. **Rate limit dépendant du DDL** : `productionRateLimit` appelle encore `ensureFinalHardeningSchema`; le rate-limit lui-même ne doit pas dépendre d'une création de table à la première requête.
6. **Catalogue fragmenté** : les chemins existants lisent à la fois `prestations` et `métier_catalog`. Le schéma réel, les données et les relations historiques n'ont pas encore été rapprochés.

## Stratégie de migration — sans exécution

- Geler les changements de schéma sur cette branche pendant l'inventaire.
- Extraire chaque instruction DDL exacte, y compris indexes, triggers, contraintes et valeurs de référence, dans des migrations SQL numérotées et ordonnées.
- Ajouter une table de suivi des migrations avec identifiant, checksum, date et version ; refuser toute divergence de checksum.
- Construire un bootstrap de migration séparé du Worker applicatif, protégé par un environnement isolé et une approbation explicite.
- Tester migrations sur une base D1 jetable, puis sur une copie de préproduction ; vérifier relance idempotente, interruption, reprise, contraintes et rollback compensatoire.
- Faire une sauvegarde chiffrée, vérifier son intégrité et effectuer une restauration complète avant toute migration préproduction.
- Convertir les helpers runtime en vérifications de schéma en lecture seule, puis retirer le DDL runtime uniquement après preuve que toutes les tables et données attendues existent.
- Ne jamais appliquer cette séquence sur la D1 de production sans validation distincte et plan de retour arrière testé.

## Non-actions effectuées

Aucune requête DDL n'a été exécutée. Aucune migration, sauvegarde, restauration, écriture D1, modification de secret, déploiement, fusion ou opération de paiement n'a été lancée.
