# PROCHÉLIA — Gate de lancement production

**Statut initial : BLOQUÉ / préproduction uniquement.**  
Version de référence constatée dans `wrangler.jsonc` : Worker `prochelia-api-staging`, entrée `src/index.js`.  
Ce document est un gate de release, pas une autorisation de déploiement.

## 0. Règles non négociables
- Ne jamais déployer depuis la branche staging.
- Ne jamais appliquer de migration D1 sans sauvegarde vérifiée, plan de retour arrière et approbation explicite.
- Garder Stripe en mode test tant que les tests de bout en bout et le rapprochement financier ne sont pas signés.
- Ne pas activer missions, payouts ou paiements réels par simple changement de flag.
- Une revue manuelle d'un rapprochement ne constitue pas une preuve de règlement PSP.
- Les décisions juridiques, financières et de mise en production restent humaines.

## 1. Gate technique (bloquant)
- [ ] CI syntaxe/configuration verte sur le commit de release.
- [ ] CI tests sécurité/paiement verte sur le commit de release.
- [ ] Dépendances verrouillées et audit de vulnérabilités exécuté (Node/Workers, npm audit ou outil équivalent).
- [ ] Comparaison root `index.js` vs Worker `src/index.js` réalisée; `src/index.js` est le main Wrangler. Éliminer l'ambiguïté de la source de vérité avant release.
- [ ] Inventaire complet des `ensure*Schema` / DDL à l'exécution terminé; plan de migration versionnée documenté.
- [ ] Aucune initialisation DDL exécutée depuis les routes de production.
- [ ] Vérification RBAC/ownership/authentification sur toutes les routes privées.
- [ ] Tests négatifs: non authentifié, rôle incorrect, ownership incorrect, CSRF/origin, rate-limit, input invalide.
- [ ] Tests de concurrence/idempotence sur paiements, remboursements, litiges, wallets et webhooks.
- [ ] Vérification des limites, pagination, erreurs et logs sans PII/secrets.

## 2. D1 / données (bloquant)
- [ ] Export/sauvegarde pré-déploiement D1 effectué et restauré dans une base isolée.
- [ ] Schéma réel de staging comparé au schéma attendu; aucune différence non expliquée.
- [ ] Migration testée sur clone; durée, locks, compatibilité et rollback documentés.
- [ ] Politique de rétention, suppression/anonymisation RGPD et audit de données validés.
- [ ] Tests de restauration et intégrité (checksum/compte) consignés.

## 3. Cloudflare / secrets / observabilité (bloquant)
- [ ] Environnement production distinct de staging (Worker, D1, R2, routes, variables).
- [ ] Secrets définis via secret store Cloudflare, jamais dans Git/logs; rotation vérifiée.
- [ ] Origin, CORS, cookies Secure/HttpOnly/SameSite, CSP et TLS vérifiés sur le domaine final.
- [ ] R2 backup configuré avec chiffrement, accès minimal, lifecycle et alerte d'échec.
- [ ] Alertes erreurs Worker, D1, webhook, paiement, sauvegarde et seuils de disponibilité configurées.
- [ ] Procédure incident, rollback Worker, restauration D1/R2 et contacts de secours testés.

## 4. Stripe / finance (bloquant)
- [ ] Stripe Sandbox checkout, webhook signé (raw body), idempotence et rejouabilité testés.
- [ ] Cas carte refusée, timeout, webhook dupliqué/retardé, montant/devise incorrects et remboursement testés.
- [ ] Tests Connect/onboarding, comptes restreints, payouts, litiges et frais réalisés si ces fonctionnalités sont activées.
- [ ] Rapprochement entre transactions PSP, ledger interne, wallets et remboursements validé avec échantillons.
- [ ] Aucun payout réel activé avant validation conformité et trésorerie.
- [ ] Activation des clés live et des flags signée par une personne habilitée, après le go/no-go.

## 5. Produit, légal et opérations (bloquant)
- [ ] Parcours client/intervenant/gérante testés sur mobile, tablette et desktop.
- [ ] Contrats, CGU/CGV, politique confidentialité, cookies, médiation, rétractation et responsabilités relus par conseil compétent.
- [ ] Rôles PROCHÉLIA/intervenants et statut d'intermédiaire validés juridiquement; aucune promesse de conformité automatique.
- [ ] Tarifs, commissions, frais, annulations, remboursements, factures et taxes validés.
- [ ] Support, litiges, signalement, modération, incidents et escalade opérationnels.
- [ ] Accessibilité, langues, notifications et consentements testés.
- [ ] Dossier de recette signé et plan de lancement progressif (feature flags, canary, monitoring) approuvé.

## 6. Go / No-Go final
Le lancement est **GO uniquement si toutes les cases bloquantes sont cochées**, les preuves sont attachées au commit/tag de release et les responsables techniques, sécurité, finance et juridique ont signé.

À défaut d'une seule preuve : **NO-GO**, conserver staging et Stripe Sandbox.

## Preuves minimales à joindre
- SHA du commit/tag de release.
- Liens CI + rapports de tests.
- Rapport d'audit sécurité/dépendances.
- Rapport de comparaison D1 et preuve de restauration.
- Rapport Stripe Sandbox et rapprochement.
- Procès-verbal de recette produit.
- Validation juridique et financière.
- Décision Go/No-Go et plan de rollback.
