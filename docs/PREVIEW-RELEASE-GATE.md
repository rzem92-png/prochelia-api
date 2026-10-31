# PROCHÉLIA — garde-fous de préproduction et de mise en production

Dernière révision : 31 octobre 2026

## État vérifié

- La validation GitHub de l'API exécute la syntaxe, le bundle Wrangler en mode `--dry-run` et les tests Node.
- Le contrôle CI exécute la syntaxe, les bundles Wrangler en dry-run (configuration production et configuration preview) et la suite complète de tests Node.
- Le run `41183435612` a réussi sur le commit `340a8a30a21fe07dc3474b127b94a54dff747246`, après correction des assertions de tests devenues obsolètes.
- `wrangler.jsonc` référence la D1 de production ; son usage CI est strictement limité au dry-run.
- `wrangler.preview.jsonc` référence un Worker et une D1 dédiés à la preview ; l'identifiant preview est différent de celui de production.
- Un workflow manuel dédié valide les identifiants et l'isolation avant un éventuel déploiement preview ; il ne lance aucune migration D1.
- Un Preview Cloudflare a été confirmé sur le commit `0972c36`. Le Preview des commits plus récents doit encore être confirmé.
- Le raccordement réel du navigateur Pages à l'API, notamment session, CORS/CSRF et Safari iOS/desktop, n'est pas encore validé.

## Règle impérative : ne pas déployer la configuration actuelle en préproduction

Le fichier `wrangler.jsonc` contient le binding D1 de production. Un déploiement de ce Worker avec cette configuration pourrait connecter le code de préproduction à la base de production.

En conséquence :

1. Ne pas utiliser `wrangler deploy` avec `wrangler.jsonc` pour un test de préproduction.
2. Ne pas exécuter de migration D1, de script SQL d'initialisation, ni de test d'écriture sur la base de production.
3. Ne pas créer un identifiant D1 fictif ou réutiliser l'identifiant de production.
4. Ne pas configurer l'interface de préproduction pour basculer silencieusement vers l'API de production.

## Prérequis avant un Worker de préproduction

- Créer une base D1 dédiée à la préproduction dans le compte Cloudflare.
- Récupérer et vérifier son identifiant depuis Cloudflare.
- Créer un fichier Wrangler dédié à la préproduction (par exemple `wrangler.preview.jsonc`) avec un nom de Worker distinct et le binding D1 préproduction uniquement.
- Vérifier que les secrets et variables de préproduction sont distincts : authentification, CORS, webhooks, notifications, stockage R2, clés de chiffrement et fournisseurs externes.
- Vérifier les origines CORS exactes du domaine Pages de préproduction.
- Appliquer les migrations uniquement à la base D1 de préproduction après sauvegarde et revue du diff SQL.
- Exécuter les tests API, les tests de contrat navigateur et les parcours Client / Intervenant / Gérante sur des comptes et données fictifs.
- Contrôler les journaux, les erreurs, les permissions et l'absence de données de production.

## Diagnostic du build Cloudflare

Le succès de `wrangler deploy --dry-run` dans GitHub Actions prouve que Wrangler peut construire le bundle localement avec le code et la configuration contrôlés. Il ne prouve pas que la configuration de build distante Cloudflare est correcte.

En cas d'échec du build distant, relever avant toute modification :

- le Build ID Cloudflare ;
- la commande de build configurée dans Cloudflare Workers Builds ;
- le répertoire racine du projet ;
- la version de Node.js et la version de Wrangler réellement utilisées ;
- le premier message d'erreur bloquant du journal (pas seulement la dernière ligne).

Ne pas modifier les paramètres Cloudflare à l'aveugle. Ne pas transformer un échec de build en déploiement forcé.

## Conditions de mise en production

La production reste bloquée tant que les points suivants ne sont pas démontrés :

- revue sécurité et RBAC sur les trois espaces ;
- migrations D1 versionnées, testées et réversibles ;
- sauvegarde et restauration réellement testées ;
- secrets et services externes configurés et vérifiés ;
- tests PSP en sandbox, rapprochement comptable et idempotence ;
- tests de bout en bout sur les parcours critiques ;
- validation mobile iOS / Android et desktop ;
- contrôle RGPD, conservation, suppression/anonymisation et journalisation ;
- approbation explicite de la Gérante.

## Politique SUPRA

IA SUPRA peut analyser, classifier, calculer des indicateurs en lecture seule, préparer des scénarios et formuler des recommandations. Les remboursements, paiements, virements, changements tarifaires, engagements contractuels, suppressions de données et décisions à impact élevé restent bloqués jusqu'à validation humaine et preuve d'exécution vérifiable.

Une proposition générée, une requête acceptée ou un statut local ne constituent jamais la preuve qu'une opération métier a été exécutée.
