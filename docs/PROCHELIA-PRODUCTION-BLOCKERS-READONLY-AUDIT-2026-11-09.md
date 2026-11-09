# PROCHÉLIA — audit statique des bloqueurs de production (2026-11-09)

**Type :** revue statique en lecture seule du backend de la branche par défaut.  
**Décision :** **NO-GO production, NO-GO encaissements et payouts live.**  
**Périmètre examiné :** `src/index.js` (blob SHA `18c14da119def80f380169bfe21e78a33026f09e`), `src/v7.js` (blob SHA `2dbc333bc96789ebb91acd1988855803c41f5c0f`), `src/v7-routes.js` (blob SHA `3cef3ab687951362058f6f9cf5f3884678c5cbf3`), `migrations/0002_server_pricing.sql` (blob SHA `2af369f921d7dc7b8284d6058434fa513b5b80b6`).  
**Limite :** lecture de code, sans exécution dynamique, sans accès à une base en écriture, sans test d'intrusion et sans validation PSP. Les constats ci-dessous sont des défauts visibles dans le code examiné ; ils ne prétendent pas décrire un incident réellement survenu.

## 1. Résumé exécutif

Le backend contient des briques de sécurité et de paiement, mais les contrôles observés ne suffisent pas à autoriser un trafic transactionnel réel. Plusieurs chemins peuvent produire un état financier local sans preuve de règlement externe, et les opérations sensibles ne démontrent pas toutes une atomicité robuste face à la concurrence ou à une panne intermédiaire.

Ne pas corriger ces défauts par un simple changement de variables d'environnement. La correction exige une conception de ledger et de transitions d'état, des tests d'intégration D1/PSP en sandbox, puis une revue indépendante.

## 2. Constats classés par criticité

### P0 — Une route d'administration peut déclarer un paiement « paid » sans confirmation PSP visible

**Emplacement :** `src/index.js`, `finalizeMissionPayment()`.  
**Constat :** la fonction accepte `outcome='paid'` après contrôle du rôle `gerante`, puis met directement la transaction en `paid` et crédite le wallet. Elle ne vérifie pas dans cette fonction un identifiant de paiement PSP, une signature d'événement, un statut récupéré auprès du PSP ou une preuve de capture. Le crédit wallet est effectué dans une requête distincte de la mise à jour transactionnelle.  
**Risque :** création d'un solde disponible interne sans preuve de fonds encaissés ; incohérence si une des écritures échoue.  
**Correction requise :** supprimer tout chemin de finalisation manuelle positive. Seul un événement PSP authentifié, rapproché d'une intention de paiement immuable et confirmé par interrogation serveur PSP, peut faire évoluer le ledger. Une intervention admin ne doit que placer en revue/suspension et jamais fabriquer une confirmation de règlement. Regrouper la transition transaction + ledger dans une opération atomique avec contraintes d'état.  
**Tests bloquants :** refus d'un `paid` manuel ; webhook valide avec paiement PSP vérifié ; webhook falsifié, ancien, inconnu, montant/devise/compte incohérent ; panne entre écritures ; répétition concurrente.

### P0 — Configuration de paiement trop faible pour établir une readiness

**Emplacement :** `paymentsConfigured(env)`.  
**Constat :** la fonction retourne vrai si `PAYMENT_WEBHOOK_SECRET` et `PAYMENT_PROVIDER` sont présents. Cela ne prouve pas qu'un adaptateur de charge/payout existe, que les identifiants PSP sont valides, que les comptes sont habilités, ni que ledger, remboursement et rapprochement sont opérationnels.  
**Risque :** affichage d'un état « configuré » alors que le flux de paiement réel n'est pas prêt.  
**Correction requise :** readiness composée de contrôles serveur indépendants et explicites par capacité ; état fermé par défaut. Une variable d'environnement ne doit jamais valoir preuve d'intégration. Séparer configuration, connectivité PSP, capacités activées, readiness produit et autorisation humaine du trafic réel.  
**Tests bloquants :** secrets présents sans adaptateur ; adaptateur indisponible ; capacités manquantes ; clés sandbox/live ; état prêt faux tant que chaque preuve n'est pas validée.

### P0 — Réservation de payout non démontrée atomique sous concurrence

**Emplacement :** `payoutRequest()`.  
**Constat :** lecture du solde, débit/réservation du wallet et insertion de la demande sont effectués par des requêtes séparées. L'UPDATE du wallet n'a pas de prédicat conditionnel `available_cents >= amount` et le code présenté ne vérifie pas le nombre de lignes modifiées. L'idempotency key n'est pas liée ici à une empreinte du payload et à l'acteur.  
**Risque :** courses concurrentes, sur-réservation, wallet débité sans demande créée ou demande dupliquée ; réutilisation de clé avec un autre contenu.  
**Correction requise :** transaction/batch atomique D1 avec UPDATE conditionnel et contrôle de `changes`, contrainte d'unicité de l'idempotency key, liaison à l'acteur et à l'empreinte canonique du payload, réservation et création de demande dans la même unité atomique. Toute réutilisation de clé avec payload différent doit retourner un conflit.  
**Tests bloquants :** deux payouts simultanés dépassant le solde combiné ; panne après chaque instruction ; clé répétée même payload ; clé répétée payload différent ; utilisateur différent ; retries réseau.

### P0 — Consommation du webhook avant garantie de traitement complet

**Emplacement :** `paymentWebhook()`.  
**Constat :** l'événement est inséré avec `INSERT OR IGNORE` avant l'application de ses effets métier. Si une étape ultérieure échoue, une nouvelle livraison du même identifiant peut être reconnue comme doublon et acquittée alors que l'événement n'a pas été entièrement traité. Le marqueur `processed=1` est écrit à la fin, mais le chemin doublon ne distingue pas nécessairement un événement déjà traité d'un événement seulement enregistré.  
**Risque :** événement perdu ou bloqué en état incomplet, wallet et transaction désynchronisés.  
**Correction requise :** machine d'état webhook `received/processing/processed/failed`, lease récupérable, nombre de tentatives, erreur persistée et reprise idempotente. Les effets ledger + état métier + marqueur traité doivent être atomiques lorsque la base le permet ; sinon utiliser outbox/inbox et compensation vérifiable. Ne jamais acquitter comme traité un événement incomplet.  
**Tests bloquants :** panne après insertion ; panne après transition ; reprise lease ; événements désordonnés ; répétition concurrente ; événements inconnus ; échec D1.

### P1 — Vérification de signature webhook sans fenêtre temporelle visible

**Emplacement :** `verifyWebhookSignature()`.  
**Constat :** HMAC-SHA256 sur le corps brut et comparaison de signature sont présents. Aucun timestamp, tolérance temporelle ou vérification anti-rejeu n'est visible dans cette fonction. La déduplication par identifiant d'événement aide, mais ne remplace pas la validation temporelle et le contrôle du fournisseur.  
**Risque :** rejeu d'une requête signée capturée, selon le contrat du fournisseur et la portée de la clé.  
**Correction requise :** utiliser le mécanisme de signature officiel du PSP (timestamp, tolérance, secret par endpoint, rotation), comparaison en temps constant, validation de l'environnement et du compte marchand, et identifiant d'événement unique par fournisseur/compte. Ne pas inventer un format générique si le PSP fournit son propre SDK de vérification.  
**Tests bloquants :** signature valide, invalide, timestamp hors fenêtre, rejeu, secret ancien/rotaté, compte et environnement incohérents.

### P1 — Création d'intention de paiement fondée sur les identifiants de requête

**Emplacement :** `createMissionPayment()`.  
**Constat :** l'intention reçoit mission, client et intervenant depuis le corps, et calcule brut/commission depuis les valeurs transmises. Dans cette fonction, la mission réelle, son statut, son prix serveur, l'affectation intervenant et l'ownership du client ne sont pas relus avant insertion. Le replay idempotent retourne la ligne existante sans comparer l'acteur ni l'empreinte du payload.  
**Risque :** création d'une intention financière liée à des parties, montants ou missions non autorisés ou incohérents.  
**Correction requise :** charger mission, affectation, état, tarif et politique depuis les sources serveur ; recalculer le montant intégralement côté serveur ; lier clé d'idempotence à acteur + payload + ressource ; vérifier le propriétaire et les transitions autorisées.  
**Tests bloquants :** mission inexistante/annulée ; client/intervenant falsifiés ; prix client modifié ; mission déjà payée ; acteur non autorisé ; clé idempotente réutilisée.

### P1 — Readiness API limitée à la présence D1 et de tables

**Emplacement :** route `GET /api/readiness`.  
**Constat :** la réponse `ready` est déterminée par `SELECT 1` et l'existence des tables `missions` et `users`. Le booléen ne démontre ni migrations complètes, ni auth/RBAC, ni workflows, ni intégrité des paiements, ni sauvegarde restaurable, ni support, ni sécurité, ni conformité.  
**Risque :** un outil de supervision ou opérateur peut interpréter un signal d'infrastructure comme une autorisation de trafic réel.  
**Correction requise :** séparer au minimum `infrastructure_ready`, `schema_ready`, `product_ready`, `financial_ready`, `security_ready` et `real_traffic_authorized`. Ce dernier reste false par défaut et ne peut être ouvert que par une procédure d'approbation serveur et humaine documentée.  
**Tests bloquants :** base accessible avec migrations manquantes ; table minimale sans workflow ; paiements non prêts ; gate juridique manquante ; état réel toujours NO-GO.

### P1 — Résolution de litige et remboursement sans ledger complet visible

**Emplacement :** `paymentAdminResolve()`.  
**Constat :** la résolution met à jour le litige puis le statut de transaction par instructions séparées. Les résolutions `partial_refund` et `full_refund` modifient le statut local, mais le code examiné ne montre pas l'exécution d'un remboursement PSP, de mouvements de ledger correspondants ni d'un rapprochement.  
**Risque :** statut local « refunded » sans remboursement externe effectif ou sans traçabilité des montants partiels.  
**Correction requise :** workflow de remboursement distinct, montant plafonné sur le solde remboursable, demande PSP idempotente, confirmation PSP, ledger immuable, rapprochement et audit. Le statut du litige ne doit pas simuler un mouvement de fonds.  
**Tests bloquants :** remboursement total/partiel, retries, refus PSP, remboursement supérieur au montant, remboursement répété, litiges concurrents.

## 3. Mesures conservatoires immédiates

1. Garder encaissements, remboursements et payouts live désactivés.
2. Ne pas utiliser `finalizeMissionPayment(outcome='paid')` comme mécanisme opérationnel.
3. Ne pas interpréter `payments_configured` ou `/api/readiness.ready` comme preuve de readiness financière ou de release.
4. Ne pas modifier les soldes wallets manuellement pour corriger un incident.
5. Préserver les journaux et états existants ; ne pas lancer de migration ou de réparation de données sans backup vérifié, plan de retour arrière et approbation.
6. Faire une revue dédiée du schéma complet et des contraintes uniques/foreign keys avant de concevoir les transactions atomiques.

## 4. Ordre de correction recommandé

- **Étape 1 — Cartographie :** toutes les routes qui changent transaction, wallet, payout, dispute et webhook ; schéma SQL et contraintes ; adaptateur PSP réellement utilisé.
- **Étape 2 — Modèle financier :** ledger immuable, devis serveur, états autorisés, identifiants PSP, idempotence acteur+payload, rapprochement.
- **Étape 3 — Transactions atomiques :** réservation, finalisation PSP, refunds et payouts ; tests de concurrence, crash et reprise.
- **Étape 4 — Webhooks :** vérification officielle PSP, inbox/lease/retry, atomicité et gestion des événements inconnus/désordonnés.
- **Étape 5 — Readiness :** gates séparées, non contournables, preuves liées à un commit et à un environnement.
- **Étape 6 — Validation :** tests unitaires et intégration Worker+D1 isolée, sandbox PSP, fault injection, E2E navigateur, revue sécurité indépendante et revue juridique/financière.
- **Étape 7 — Release :** canary limité, surveillance, plan de rollback et approbation humaine explicite. Aucune promotion automatique.

## 5. Preuves non obtenues pendant cette revue

Aucun test applicatif n'a été exécuté dans cette revue statique. Aucun PSP sandbox E2E, webhook réel, test de concurrence, fault injection, restauration complète, test navigateur, audit externe ou vérification juridique n'a été réalisé ici. Aucun code runtime, secret, schéma D1, paiement, environnement Cloudflare ou déploiement n'a été modifié.

## 6. Décision

**NO-GO maintenu.** Le backend ne doit pas être déclaré prêt pour la production transactionnelle sur la base de la configuration ou de la seule disponibilité de D1. La correction doit se faire par lots isolés, avec tests et preuves reproductibles, sans contourner les gates de sécurité ni fusionner en masse des branches divergentes.
