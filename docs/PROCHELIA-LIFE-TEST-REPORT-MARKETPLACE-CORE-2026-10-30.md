# PROCHÉLIA LIFE — compte rendu de test ciblé marketplace-core

**Date : 30 octobre 2026**  
**Périmètre :** module `src/marketplace-core.js` et test `tests/marketplace-core.test.mjs` de la branche de préproduction.  
**Environnement :** Node.js v22.16.0, environnement temporaire isolé, sans accès à D1, Stripe, Cloudflare ou aux interfaces web.

## Résultat ciblé

Le code et les sept scénarios du module ont été reproduits dans un répertoire temporaire isolé à partir du contenu relu sur GitHub, puis exécutés avec `node --test`.

Résultat observé :
- 7 tests exécutés ;
- 7 réussis ;
- 0 échec ;
- 0 test ignoré.

Scénarios :
1. rapprochement de la répartition paiement client / versement professionnel / commission / taxe ;
2. détection d'un écart de rapprochement ;
3. rejet des nombres décimaux, négatifs et hors plage entière sûre ;
4. rejet du dépassement arithmétique de la contribution de plateforme ;
5. transitions normales de commande jusqu'à la réalisation ;
6. blocage de la réalisation avant paiement et de la résurrection d'un état terminal ;
7. présence des états de remboursement partiel et de litige.

## Portée exacte de ce résultat

Ce résultat valide uniquement les fonctions pures du module et les sept scénarios ci-dessus, dans le code reproduit depuis les fichiers consultés. Il ne constitue pas l'exécution du script complet `npm run test:prelaunch` dans un clone intégral du dépôt.

Il ne valide pas :
- les routes API, l'authentification ou les autorisations en conditions réelles ;
- les écritures, transactions, contraintes ou migrations D1 ;
- les paiements, webhooks, remboursements ou versements Stripe ;
- les interfaces Client, Intervenant et Gérante ;
- les sauvegardes/restaurations R2 ;
- la sécurité, la charge, les notifications, ni les services tiers.

## Suite obligatoire

Exécuter le script complet `npm run test:prelaunch` sur le dépôt exact, puis les tests d'intégration sur D1 isolée et les parcours PSP de test. Archiver les journaux et les versions testées. Ne pas activer la production tant que les tests bloquants ne sont pas tous passés et que les contrôles juridiques, sécurité, données et opérations ne sont pas signés.

**Décision : test ciblé marketplace-core réussi ; préproduction globale non certifiée ; aucune autorisation de mise en production.**
