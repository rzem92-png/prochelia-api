# Audit D1 préproduction — lecture seule

Date de contrôle : 2026-11-07 (UTC à confirmer côté opérateur).  
Base ciblée : `prochelia-preview-db` — UUID `6adb95e5-e542-4bec-9008-fbea01042305`.  
**Aucune écriture, migration, suppression ou restauration n'a été effectuée.**

## Résultats observés via Cloudflare D1 API
- Tables (hors sqlite internes) : **25**.
- Index (hors sqlite internes) : **18**.
- `d1_migrations` existe et contient **4** entrées : `0001_core_business_schema.sql`, `0002_server_pricing.sql`, `0003_route_address_provenance.sql`, `0004_atomic_wallet_ledger.sql` (30/10/2026).
- Tables principales présentes : `users`, `clients`, `intervenants`, `missions`, `paiements`, `payment_wallet_ledger`, `wallets`, `sessions`, `prestations`, `tarifs`.
- `PRAGMA foreign_key_check` : résultat vide (aucune violation retournée).
- Taille D1 annoncée par l'API lors de la lecture : **335 872 octets**.
- `PRAGMA integrity_check` : **non exécuté avec succès**; Cloudflare API a retourné `SQLITE_AUTH`. Ce résultat ne prouve ni corruption ni intégrité complète.

## Interprétation
- La base staging existe et contient un schéma non trivial; ne pas la remplacer ni réinitialiser.
- Les 4 migrations enregistrées ne prouvent pas à elles seules que le schéma courant correspond à la version du code Worker.
- Les résultats de foreign-key-check ne remplacent pas les tests applicatifs, l'inventaire des contraintes, ni une restauration vérifiée.
- Aucun contenu métier, email, téléphone, token ou donnée personnelle n'a été extrait dans ce rapport.

## Suite bloquante avant release
1. Export D1 de staging et restauration dans une base isolée.
2. Comparaison exhaustive de `sqlite_master`, colonnes, contraintes, index et versions de migration avec les attentes du Worker.
3. Tests applicatifs sur base clonée et plan de rollback.
4. Vérification `integrity_check` via une voie autorisée (Cloudflare dashboard/CLI ou export local).
5. Refaire ces étapes sur l'environnement production séparé avant tout déploiement.

**Statut : audit de lecture staging effectué; D1 production et intégrité globale restent non certifiées.**

## Worker preview — inspection configuration en lecture seule
- Worker identifié : `prochelia-api-preview` (annotation : preview-only).
- Binding `APP_ENV=preview`.
- Binding D1 `DB` pointe vers l'UUID staging attendu `6adb95e5-e542-4bec-9008-fbea01042305`.
- `CORS_ORIGIN` inclut les deux domaines Pages staging déclarés.
- Subdomain workers.dev activé et previews activées.
- Observability globale `enabled=false` (les logs d'invocation sont indiqués enabled/persist=true).
- Liste de bindings secrets Worker retournée vide. Les clés Stripe et autres secrets ne sont donc pas confirmés présents sous forme de secret Worker. Ne pas injecter de clé live; configurer sandbox via secret store et vérifier le secret sans jamais afficher sa valeur.
- Test HTTP externe du Worker depuis l'environnement d'outils bloqué par politique réseau (`403 requests ... are not allowed`); aucune réponse health endpoint n'est certifiée depuis ce contrôle.
