# PROCHÉLIA — audit de sécurité et de préparation préproduction

Date de l'audit : 2026-10-31  
Branche : `audit/preprod-release-gate-20261031`  
Périmètre : lecture statique du fichier `src/index.js` et des garde-fous backend.  
Statut : **NON PRÊT POUR LA PRODUCTION**. Ce document ne vaut ni recette D1, ni test d'intrusion, ni validation juridique.

## Résultats vérifiés dans le code

### 1. Limiteur de débit — blocage
Dans `productionSubjectHash`, l'adresse IP est déterminée par `CF-Connecting-IP`, puis par `X-Forwarded-For` si le premier en-tête est absent. Ce repli accepte une valeur contrôlable par le client dans les environnements où le proxy ne la réécrit pas.  
Dans `productionRateLimit`, le compteur suit un schéma SELECT puis UPDATE/INSERT séparé. Deux requêtes concurrentes peuvent lire le même compteur et perdre une incrémentation.  
**À corriger :** ne faire confiance qu'à une adresse fournie par le proxy de confiance; refuser ou utiliser une clé de secours serveur si elle manque. Utiliser une opération atomique SQLite/D1 (UPSERT avec incrément) et tester la concurrence sur une D1 isolée.

### 2. Protection CSRF — non démontrée, blocage
`securityOriginAllowed` autorise les requêtes sans en-tête `Origin`. Le code consulté autorise `x-csrf-token` en CORS preflight, mais cela ne démontre pas une validation d'un jeton CSRF lié à la session sur les routes mutantes. Le cookie de session est `SameSite=None`.  
**À corriger :** mettre en place une protection CSRF vérifiée côté serveur pour les requêtes authentifiées par cookie, avec jeton lié à la session et contrôle d'origine. Préserver des chemins séparés et authentifiés pour webhooks PSP, tâches serveur et autres flux non navigateur. Ajouter des tests négatifs sans Origin, avec Origin hostile, jeton absent, invalide et réutilisé.

### 3. DDL exécuté à l'exécution — blocage de livraison
Le code contient des fonctions `ensure*Schema` qui exécutent des `CREATE TABLE/INDEX` via D1. Les chemins observés appellent notamment les initialiseurs support et Copilot depuis les requêtes. Une comparaison de noms de tables avec les migrations existantes n'est pas une preuve d'équivalence structurelle.  
**À corriger :** inventorier toutes les instructions DDL, index, contraintes, clés étrangères, triggers et données de référence; les comparer structurellement aux migrations versionnées; tester sur une base D1/SQLite jetable. Ne supprimer aucun initialiseur avant d'avoir une migration équivalente vérifiée. Aucune migration réelle n'est autorisée dans cet audit.

### 4. Résolution de dossiers financiers — blocage
`financeProblemResolve` permet au propriétaire d'un dossier ou à certains rôles de gestion de passer `approve` à vrai et de marquer le dossier `RESOLVED`. Cette opération est une résolution de dossier, pas une preuve de remboursement ou de mouvement de fonds; le code ne doit jamais laisser cette valeur être interprétée comme une opération PSP exécutée.  
**À corriger :** séparer accusé de prise en charge, résolution administrative et transaction financière réelle. Toute opération de remboursement, versement ou modification de solde doit exiger rôle autorisé, preuve PSP vérifiée, idempotence et approbation humaine explicite, puis rapprochement.

### 5. Création de dossiers support — blocage
`supportCreate` prend la sévérité depuis le corps de la requête et utilise cette valeur dans la classification et la décision d'automatisation. Des identifiants de société, mission et réclamation sont également lus dans le corps; l'extrait vérifié ne montre pas de contrôle d'appartenance associé avant insertion.  
**À corriger :** dériver la sévérité à partir de faits vérifiés côté serveur; vérifier l'accès et l'appartenance de chaque référence à l'utilisateur authentifié; ne jamais autoriser une baisse de sévérité par le demandeur.

### 6. Copilote — mode plan, pas agent autonome
Le prompt et la réponse de `copilotAsk` indiquent un contexte D1 en lecture seule et une exécution métier non effectuée. Cependant, la sortie du modèle participe à `approval_required` et au statut du plan.  
**À corriger :** imposer la matrice d'approbation côté serveur, indépendante de la réponse du modèle. Le modèle ne peut ni réduire un niveau d'approbation, ni confirmer une action externe. Les actions sensibles (paiements, remboursements, litiges, droits RGPD, identité, sécurité, suspension/suppression, contrats, emploi, soins) restent sous validation humaine.

## Preuves et limites

- Les constats ci-dessus proviennent d'une inspection statique du code source de la branche indiquée.
- Aucun test d'intégration D1, test de concurrence, test E2E navigateur, test Stripe sandbox, test de restauration R2, test d'intrusion ou audit juridique n'est attesté par ce document.
- Le contrôle statique ne prouve pas le comportement réel des services Cloudflare, des secrets, des webhooks, du frontend ou des fournisseurs externes.
- Les tests historiques ne sont pas transférables à un nouveau commit sans exécution sur ce SHA exact.
- Aucune migration D1, écriture en production, fusion de PR ou mise en service n'est autorisée par cet audit.

## Conditions minimales avant une décision de lancement

1. Corriger les blocages ci-dessus et ajouter des tests unitaires et d'intégration négatifs.
2. Vérifier la parité complète des migrations et exécuter les migrations uniquement sur une base jetable isolée.
3. Exécuter toute la suite sur le commit exact, conserver les logs et rapports CI.
4. Déployer une préproduction isolée et vérifier le SHA réellement déployé.
5. Réaliser les parcours E2E Client, Intervenant et Gérante, y compris contrôle d'accès croisé et cas d'erreur.
6. Tester Stripe en sandbox, webhooks signés, idempotence, remboursements simulés et rapprochement.
7. Tester sauvegarde, intégrité, restauration et reprise après incident.
8. Faire valider les contrats, le modèle d'intermédiation, les obligations SAP, assurances, RGPD et paiements par les professionnels compétents.
9. N'ouvrir la production qu'après revue humaine explicite, plan de retour arrière et validation de chaque responsable.

**Décision actuelle : préproduction/audit uniquement — lancement production bloqué.**
