# PROCHÉLIA LIFE — audit de consolidation et rentabilité

**Date de l'audit : 30 octobre 2026**  
**Périmètre :** lecture du dépôt `rzem92-png/prochelia-api`, branche `prelaunch/v14.5.7-consolidation-audit`.  
**Statut :** audit documentaire et statique du code. Aucune exécution locale des tests, aucune connexion à la base D1, aucun déploiement, aucune migration et aucun paiement réel effectués.

## 1. Éléments observés dans le dépôt

- Le dépôt est public et la branche de préproduction consultée existe.
- `wrangler.jsonc` cible `prochelia-api-staging`, une base D1 de préproduction et un bucket R2 nommé `prochelia-preview-backups`.
- Le Cron de sauvegarde déclaré est `0 3 * * *` (03:00 UTC).
- Le runbook indique explicitement que la configuration seule ne prouve pas l'exécution d'une sauvegarde ou la réussite d'une restauration.
- `package.json` déclare un script `test:prelaunch` regroupant six fichiers de tests.
- Les tests comprennent des tests de comportement pour certains helpers (notamment signature Stripe et économie de marketplace), mais plusieurs tests vérifient la présence de motifs dans le code source. Ces tests de contrat statique ne remplacent pas les tests d'intégration D1, navigateur, PSP ou tests de charge.
- `src/trust-passport.js` contient une fonction déterministe d'éligibilité qui échoue en mode fermé lorsque les preuves requises ne sont pas valides.
- `src/stripe-adapter.js` contient une vérification de signature Stripe sur le corps brut et une construction de payload Checkout.
- `src/marketplace-core.js` fournit des fonctions pures pour le rapprochement financier et les transitions d'état de commande. Ce module ne réalise ni persistance D1, ni mouvement d'argent, ni appel PSP.
- `POST /api/missions` est explicitement désactivé dans le code consulté.
- La notice RGPD et plusieurs documents juridiques sont explicitement marqués comme brouillons à compléter/valider avant publication.
- Les tentatives de lecture des chemins racine `README.md`, `LICENSE`, `NOTICE`, `SECURITY.md` et des lockfiles usuels n'ont pas abouti sur cette branche aux chemins testés. Cela doit être confirmé par un inventaire complet du dépôt avant de conclure à leur absence définitive.

## 2. Correction ciblée réalisée

Le calcul de contribution de plateforme dans `src/marketplace-core.js` vérifiait les entrées monétaires et l'allocation, mais ne contrôlait pas explicitement le dépassement de la plage entière sûre après soustraction des frais, remises et coûts variables.

Correction ajoutée :
- rejet explicite avec `PLATFORM_CONTRIBUTION_OVERFLOW` si le résultat n'est pas un entier JavaScript sûr ;
- test de régression ajouté dans `tests/marketplace-core.test.mjs`.

Cette correction protège ce helper pur contre une marge imprécise. Elle ne prouve pas que les données de marge de toute l'application sont correctes ni que les paiements réels sont réconciliés.

## 3. Limites de validation à lever

Les statuts de vérification consultés pour les commits de documentation et de correction ne renvoient aucun statut CI exploitable. Cela ne prouve ni succès ni échec : le résultat est **non vérifié**.

Avant de qualifier le socle de prêt :
1. exécuter `npm run test:prelaunch` dans un environnement Node compatible et conserver la sortie complète ;
2. ajouter/faire tourner des tests d'intégration sur une base D1 isolée, avec schéma réel ;
3. vérifier les migrations, contraintes, index, triggers et compatibilité des données déjà présentes ;
4. tester les parcours authentification, RBAC, devis, commande, paiement, webhook, remboursement, litige, versement et rapprochement avec PSP de test ;
5. vérifier la restauration complète d'une sauvegarde dans une base D1 temporaire isolée, puis la réapplication des suppressions RGPD postérieures à la sauvegarde ;
6. faire des tests de sécurité et de charge, avec preuves et seuils de réussite ;
7. tester séparément les interfaces Client, Intervenant et Gérante, les notifications et les services tiers.

## 4. Points financiers bloquants avant lancement commercial

- Définir contractuellement et comptablement qui vend, facture, encaisse, rembourse et supporte chaque risque, pour chaque catégorie.
- Distinguer GMV, chiffre d'affaires comptable, commissions acquises, fonds de tiers, taxes et trésorerie disponible.
- Réconcilier chaque transaction avec les événements PSP, les frais PSP, les remboursements, les litiges, les versements et le grand livre interne.
- Démontrer l'idempotence des webhooks et la reprise après interruption.
- Calculer la marge contributive réelle par activité, catégorie, territoire et canal, après coûts variables, support, fraude, remboursements et remises financées par la plateforme.
- Établir le seuil de rentabilité, le budget glissant et les scénarios prudent/central/favorable.
- Vérifier que les commissions et frais sont affichés avant engagement et que les montants dus aux professionnels ne sont jamais utilisés comme trésorerie de la plateforme.

## 5. Points de gouvernance et de protection à fermer

- Inventaire complet des fichiers, auteurs/contributeurs, commits, contrats, licences et origine de chaque composant.
- Vérification des droits sur le code produit dans le cadre d'emplois, missions, prestations ou contributions externes.
- Inventaire des dépendances et licences open source, y compris composants embarqués et services tiers.
- Politique de divulgation des vulnérabilités, responsable de sécurité et coordonnées de contact à publier.
- Registre des traitements, sous-traitants, transferts, durées, consentements et procédures d'exercice des droits.
- Revue juridique des activités et des rôles réels de la plateforme ; les mentions « intermédiaire » ne suffisent pas à elles seules.
- Gouvernance Copilot : droits par rôle, journalisation, limites de dépenses, approbation humaine, mécanismes d'arrêt et interdiction d'exécuter directement une sortie de modèle.

## 6. Conditions de passage au pilote

Un pilote limité peut être envisagé seulement lorsque les tests techniques, la sécurité, les documents contractuels, la protection des données, les assurances, le PSP et les procédures de support sont validés pour la catégorie et le territoire concernés.

**Décision actuelle : PRÉPRODUCTION / AUDIT EN COURS. Pas de feu vert pour production ou ouverture commerciale générale.**


---

## 7. Audit complémentaire des remboursements PSP génériques

Une revue statique du traitement `payment_refunded` a identifié un défaut de classification : un remboursement partiel pouvait faire passer la transaction directement à l'état `refunded`, alors que le montant remboursé restait inférieur au montant brut.

Corrections ajoutées sur la branche de préproduction :
- l'état est maintenant calculé à partir du cumul remboursé : `partially_refunded` tant que le remboursement cumulé est inférieur au montant brut, puis `refunded` lorsque le total atteint le montant brut ;
- la réconciliation d'un remboursement reçu avant la confirmation du paiement calcule également la reprise proportionnelle du montant crédité au portefeuille ;
- les tests de contrat statique ont été complétés pour couvrir la distinction remboursement partiel/complet, l'ordre d'arrivée des événements et la présence du portefeuille avant déclenchement du crédit par le ledger.

Ces changements n'ont pas été exécutés contre une vraie base D1 ou un PSP de test. Il reste à démontrer, avec des événements signés de test et des scénarios concurrents, que les soldes sont exacts dans tous les ordres d'événements.

