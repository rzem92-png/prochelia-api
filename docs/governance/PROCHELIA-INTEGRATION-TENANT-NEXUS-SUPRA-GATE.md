# PROCHÉLIA — Contrat de validation de l'intégration multi-tenant / NEXUS SUPRA

Date de constat : 18 novembre 2026  
Statut : **GATE BLOQUANT — NON VALIDÉ**  
Portée : branches des PR #234, #290 et tests Worker associés.  
Décision : aucune fusion, aucune migration distante, aucun paiement réel, aucun déploiement Production.

## 1. Références auditées

| Élément | Branche / SHA observé | Observation |
|---|---|---|
| NEXUS SUPRA (#234) | `integration/nexus-supra-core-preview-2026-11-16` / `01be347463a992040cc8c5ad6ee84c6a2411df1e` | Importe et route `handleSupraRoute` dans son Worker |
| Comptabilité / contexte tenant (#290) | `feat/accounting-double-entry-ledger-2026-11-18` / `b8f8045ebc854045175fc8a2c9dec166b6e6638a` | Ajoute migrations et resolver tenant, mais son Worker n'importe ni ne route `handleSupraRoute` |
| Frontend (#32) | `fix/frontend-cookie-session-auth-2026-11-17` / `2c4ff92258e3f51dca1b2d3e96d8f4591a496b5b` | Tests E2E et preuve de cohérence déploiement/API encore à obtenir |

Les SHA sont des instantanés du contrôle, pas une affirmation qu'ils sont encore les HEAD actuels au moment d'une future exécution.

## 2. Constat d'authentification à ne pas confondre

Le resolver `getSessionUser()` de #290 sélectionne `sessions.active_tenant_id`, filtre les sessions expirées et `revoked_at IS NULL`, puis renvoie `session_active_tenant_id`. La révocation de session est donc présente dans ce HEAD.

En revanche, le même resolver renvoie `user: safeUser(row)` et ne joint pas les adhésions actives. Le module `src/tenant-context.js` fournit `resolveTenantContext()`, qui vérifie l'adhésion ACTIVE et le tenant ACTIVE, et refuse l'ambiguïté lorsqu'aucun tenant n'est sélectionné. Ce module n'enrichit pas à lui seul l'objet d'authentification global : les handlers qui s'appuient sur `auth.user.role` ou `auth.user.tenant_id` ne bénéficient pas automatiquement de ce contrôle.

Dans #234, les handlers d'approbation attendent `auth.user.tenant_id` et le rôle GERANTE. Les tests de ces handlers construisent des objets d'authentification synthétiques qui possèdent déjà `tenant_id`. Ils ne prouvent pas le trajet réel cookie → session → membership → tenant → rôle → handler.

## 3. Exigences de correction avant intégration

1. Construire une branche d'intégration dédiée, sans rebase automatique ni fusion directe des PR divergentes.
2. Établir un seul resolver d'identité et de contexte tenant, appelé sur toutes les routes protégées, pas uniquement sur `/api/tenant/context` et `/api/tenant/select`.
3. Le rôle d'autorisation doit provenir de l'adhésion active au tenant sélectionné. Un rôle global historique dans `users.role` ne doit pas conférer à lui seul des droits d'administration d'un tenant.
4. Si le compte a plusieurs adhésions actives et aucun tenant de session valide, refuser l'accès aux routes tenant-scoped avec une réponse explicite de sélection requise.
5. Le tenant cible doit provenir exclusivement de la session et de l'adhésion vérifiée. Un tenant fourni par header, query string ou JSON n'est jamais une autorité.
6. Intégrer explicitement `handleSupraRoute` au Worker intégré et vérifier le routage de chaque endpoint d'approbation.
7. Ajouter `tenant_id` obligatoire au journal d'audit NEXUS SUPRA, index tenant/temps, empreinte de payload et chaînage d'intégrité vérifiable. Toute stratégie d'ancrage externe doit être documentée. Les insertions doivent échouer fermées si le contexte tenant manque.
8. Garder `executionAllowed: false` et aucun adaptateur d'exécution sensible tant que les validations humaines, juridiques, financières et techniques ne sont pas obtenues.

## 4. Matrice minimale de tests Worker (pas seulement tests unitaires de handlers)

Chaque scénario doit traverser le vrai Worker, le cookie de session et une D1 isolée préparée avec les migrations exactes de la branche d'intégration.

| Scénario | Résultat obligatoire |
|---|---|
| Session valide, un seul membership ACTIVE, tenant ACTIVE | Contexte tenant et rôle membership correctement dérivés |
| Session révoquée | 401 ; aucune requête métier ni audit de plan exécuté |
| Session expirée | 401 |
| Aucun membership actif | 403 ; aucun accès tenant |
| Plusieurs memberships actifs sans tenant de session | 409 / sélection requise ; aucun accès métier |
| Tenant actif en session mais membership suspendu/révoqué | 403 |
| Tenant fourni dans un header/body différent du tenant de session | Ignoré ou rejeté ; aucune fuite inter-tenant |
| Rôle global GERANTE mais aucun rôle manager dans le membership courant | 403 |
| Membership manager sur tenant A, demande de ressource tenant B | 403/404 sans révélation d'existence |
| Endpoint NEXUS SUPRA appelé après authentification réelle | Route présente, rôle membership vérifié, audit tenant-scoped |
| Demande d'approbation sans tenant serveur | Refus avant toute écriture |
| Deux votes concurrents du même approbateur | Un seul vote accepté, autre requête refusée sans transition incohérente |
| Approbation à seuil multiple | Transition atomique et preuve des approbateurs distincts |
| Consommation d'approbation | Une fois seulement, tenant/action/ressource/montant/devise/payload identiques |
| Audit tenant sans contexte ou empreinte invalide | Écriture refusée ; pas de réponse de succès |
| Toute route de préparation de plan | `executionAllowed=false` ; aucun effet financier ou externe |

## 5. Gates techniques complémentaires

### Migrations
- Produire un manifeste canonique immuable : nom de fichier, SHA-256, ordre, dépendances, statut dans le ledger.
- Réconcilier les préfixes de migration qui se chevauchent entre #211 et #290 ; ne jamais déduire l'ordre uniquement du préfixe numérique.
- Rejouer la chaîne depuis une D1 vide et depuis une copie restaurée vérifiée.
- Vérifier les migrations déjà présentes dans la vraie Preview sans écrire avant revue et approbation explicite.

### Sauvegarde / restauration R2
- Backup du seul D1 Preview, chiffré, empreinte vérifiée, attestation HMAC vérifiée avec clé distincte.
- Vérifier la règle Object Lock et la rétention effective sur le préfixe exact du backup.
- Restaurer dans la D1 isolée identifiée, vérifier SQLite integrity, foreign keys, tables et ledger.
- Le succès d'un upload, d'un téléchargement ou d'un test SQLite local ne vaut pas preuve de restauration D1.

### Paiements / comptabilité
- Aucun paiement réel ni reversement tant que l'adaptateur PSP, le parcours Stripe Sandbox E2E, les idempotences, remboursements, litiges et rapprochements ne sont pas validés.
- Le ledger en partie double doit être testé en isolation : équilibre débit/crédit, écritures immuables, annulations par contrepassation, isolation tenant et idempotence.
- Les décisions fiscales, comptables et réglementaires doivent être validées par les professionnels habilités.

### Frontend / exploitation
- Prouver la correspondance exacte commit Pages Preview ↔ Worker Preview ↔ bindings D1/R2 ↔ variables runtime.
- Réparer le runner structural-smoke défaillant sans neutraliser les tests ; obtenir des logs complets et des parcours navigateur/API.
- Documenter alertes, astreinte, sauvegarde, restauration, incidents, révocation de sessions, rotation de secrets et procédure de rollback.

## 6. Critères de sortie

Le gate ne passe que si tous les scénarios requis sont verts sur le même SHA d'intégration, que les artefacts et logs sont conservés, que la restauration isolée est démontrée, que les écarts juridiques et comptables ont une validation humaine traçable, et qu'une revue de sécurité indépendante a accepté les risques résiduels.

**NO-GO PRODUCTION maintenu** jusqu'à validation formelle de l'ensemble des gates. Aucun document de planification, test unitaire isolé, statut CI isolé ou commentaire de PR ne vaut autorisation de production.
