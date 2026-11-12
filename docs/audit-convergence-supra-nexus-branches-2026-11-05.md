# Consolidation complémentaire — branches SUPRA/NEXUS et gouvernance (2026-11-05)

## Découverte importante : travail existant à réutiliser
L'audit de la branche `feat/supra-intelligence-governance-v1` révèle que SUPRA est déjà matérialisé par des modules séparés :
- `src/supra-intelligence.js` : classification/gouvernance fail-closed et simulation de résilience.
- `src/supra-orchestrator.js` : registre de domaines, planification inter-domaines et exigences d'approbation.
- `src/supra-profitability.js` : moteur de rentabilité (à auditer/tester).
- `docs/PROCHELIA-NEXUS-LIFE-STRATEGY-V1.md`, `docs/SUPRA-ARCHITECTURE-V2.md`, `docs/SUPRA-PRODUCTION-GATES-V1.md`.
- `src/index.js` de cette branche contient des imports et ajouts (identité/evidence, request body bounded, SUPRA) non présents dans la version main inspectée.

**Décision de consolidation :** ne pas réécrire SUPRA et ne pas créer un deuxième orchestrateur. Le plan d’intégration doit comparer les commits et routes de cette branche avec main/PRs, isoler les deltas, résoudre les divergences, puis tester avant toute fusion.

## État Nexus
- Stratégie LIFE/NEXUS présente dans la branche SUPRA.
- La recherche ciblée dans `main` ne confirme pas d'implémentation de tables/route Nexus talent (ex. talent_profiles) sur main.
- Le blueprint de PR #90 reste une proposition et ne remplace pas l’architecture plus riche de la branche SUPRA.
- Nexus doit devenir le domaine d’orchestration/marketplace de talent dans le socle existant, pas un produit séparé ni un nouveau catalogue/compte/paiement.

## Workflows observés
- Workflow de déploiement SUPRA preview : manuel, cible une branche précise, Worker preview dédié et D1 preview, sans migration automatique.
- Workflow de comparaison D1 est conçu en lecture seule.
- La présence d’un workflow n’est pas une preuve que les validations runtime, les secrets ou les tests de navigateur sont opérationnels.

## Plan de convergence sécurisé
1. Comparer les arbres/commits de main, branche SUPRA et PRs #87/#89/#90.
2. Déterminer un seul candidat backend consolidé (ne pas mélanger index.js de 231 KB et 263 KB sans diff).
3. Établir tests unitaires de gouvernance SUPRA et tests de contrat API.
4. Vérifier intégrité des routes/auth/CORS et toutes les mutations.
5. Isoler preview D1, migrations explicitement versionnées, sauvegarde/restore vérifiée.
6. Nexus MVP adulte seulement : profil talent, portfolio, offre, disponibilité, demandes de réservation; réutiliser utilisateurs, paiement, journal/audit.
7. Mineurs : séparation stricte, revue légale France et contrôle parental avant toute publication/mission rémunérée.
8. Mise en production uniquement après CI verte, tests réels de préproduction, revue sécurité et rollback démontré.

## Conclusion
Le prochain effort expert est une **convergence de branches et de tests**, pas une réécriture ni un merge aveugle. Le travail SUPRA déjà développé est conservé et traité comme candidat à réutilisation.
