# NEXUS SUPRA — agent développeur durable V1

## Statut constaté
Cette spécification est une cible d'architecture, pas une preuve de déploiement. Le Worker actuel expose les routes SUPRA de planification et son gestionnaire `scheduled()` est consacré aux sauvegardes nationales. La CI valide le code et des dry-runs ; elle n'exécute pas une boucle de développement autonome. La PR #12 reste brouillon et la production NO-GO.

## Objectif
Surveiller les événements autorisés de GitHub et de l'environnement Preview, diagnostiquer avec des preuves, proposer des correctifs sur une branche dédiée, lancer les tests et préparer une PR brouillon. Un résultat n'est terminé qu'après confirmation indépendante par GitHub Actions, Cloudflare ou un test d'acceptation.

## Architecture cible
1. **Événements** — Webhooks GitHub signés (push autorisés, workflow_run, pull_request) et contrôles planifiés de santé. Déduplication par delivery ID et clé d'idempotence.
2. **Réception** — Worker dédié vérifiant HMAC, horodatage, taille et identifiant ; Queue et dead-letter queue pour les échecs persistants. Un payload n'est jamais interprété comme commande.
3. **Exécution durable** — Cloudflare Workflows avec étapes persistées, retries bornés/backoff, attente d'approbation, reprise et état corrélé : collecte de preuves, classification, cause racine, patch, branche, CI, examen des résultats, PR.
4. **Diagnostic** — chaque constat référence un run, job, commit, fichier ou réponse API. Distinguer fait, hypothèse et recommandation ; un dry-run n'est pas un déploiement et un test statique n'est pas un E2E.
5. **Correctifs** — branche dédiée depuis une base autorisée, diff limité aux chemins approuvés, tests et scans, PR brouillon. Aucun script arbitraire issu des logs/issues/webhooks. Aucun merge automatique.
6. **Droits** — GitHub App dédiée avec permissions minimales, jetons courts et rotation. Token Cloudflare Preview-only. Aucun droit Production, DNS, Billing, paiement ou modification des secrets.
7. **Approbation humaine** — obligatoire pour merge, Production, migrations, paiements/remboursements/reversements, tarification, suppression/export de données et changement de secrets. Toute action ambiguë est bloquée.
8. **Observabilité** — journal append-only des événements, décisions, preuves, patchs, tests et approbations ; métriques, alertes DLQ/heartbeat/échecs et rétention minimisée.

## Phases de livraison
- **A — sécurité** : cartographier permissions réelles, schémas workflow/journal/idempotence/DLQ, tests HMAC/rejeu/doublon/payload/limites, prouver l'isolation Production.
- **B — observateur lecture seule** : webhooks + planification, collecte CI/commits/PR/Preview, rapports sourcés, aucun changement de code.
- **C — correctifs Preview assistés** : branche dédiée, patch restreint, CI, PR brouillon, arrêt sûr à l'échec, tests d'injection d'instructions malveillantes dans logs/issues.
- **D — autonomie limitée après audit** : corrections faibles et réversibles dans chemins approuvés uniquement ; revue obligatoire avant merge, exercices de panne/reprise/révocation.

## Critères d'acceptation
- Reprise après interruption sans perte ni double exécution.
- Signature webhook et protection anti-rejeu démontrées.
- Traçabilité de chaque événement jusqu'à une conclusion et une preuve.
- Aucun accès aux secrets via prompts, logs ou artefacts.
- Aucun merge ou déploiement Production possible depuis l'agent.
- Test d'isolation confirmant l'absence de références aux ressources Production.
- Tests unitaires, intégration, adversariaux et reprise tous verts.
- Approbation humaine et audit indépendant avant extension de privilèges.

## Références techniques
- Cloudflare Workflows : exécution durable, étapes persistées, retries, attente d'événements et observabilité.
- Cloudflare Queues : amortissement des événements et dead-letter queue.
- Cron Triggers / schedules Workflows : réveils périodiques.
- GitHub Webhooks et GitHub App : événements authentifiés et permissions minimales.

## État de départ
Présent : endpoints SUPRA de planification, contrôles de gouvernance, CI et Cron de sauvegarde. Non démontré : Workflows SUPRA, webhook GitHub, Queue/DLQ SUPRA, agent développeur persistant, patchs autonomes et tests de reprise dédiés. La validation du commit `05daa9255c6ede91cb129272b85908f4a519c37e` a réussi sans déploiement ni migration.

**Règle de vérité :** tant que les phases A à C ne sont pas déployées en Preview et acceptées avec preuves, NEXUS SUPRA ne doit pas être qualifiée d'agent développeur autonome continu.
