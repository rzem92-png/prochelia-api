# PROCHÉLIA — audit d'écarts sécurité, finance et exploitation

**Constat au 18 novembre 2026 — 09:51 Europe/Paris**  
**Périmètre :** branche Preview API issue de la PR 283, Worker `prochelia-api-preview`, Pages `prochelia`, D1 Preview EU.  
**Nature :** audit technique factuel, non un audit légal, comptable ou de sécurité indépendant.

## 1. Déploiement Preview et cohérence des versions

- Pages Preview : déploiement `280d7457-f4df-4327-8bda-cfdfc7a06f85`, commit frontend `2072c37b59a2422257e67b2d5f385af0a4c7560b`.
- Binding Pages `DB` : `e3cf167c-37e1-4d72-9ac6-b3e27c14b97f`.
- Service Pages : `PROCHELIA_API → prochelia-api-preview`.
- Worker Preview : version 31, ID `4bd88ec8-9529-40ee-b0f6-ed52e8421ad2`, trafic 100 %.
- Commit embarqué dans le Worker : `cd166f1ad7070fadf3b99a7385a7d5857d4dbcdd`.
- HEAD de la branche PR 283 : `baafff787075f79b28a29686d3608af9cc0af422`. La comparaison GitHub montre un seul commit supplémentaire, documentaire, sans différence de code entre ces deux SHA.
- Le binding Worker `DB` pointe vers la D1 Preview attendue. Le binding `BACKUP_BUCKET` pointe vers `prochelia-preview-backups-eu-v2` avec `jurisdiction=eu`. La preuve R2 est le run GitHub 44090216004 : le journal utilise explicitement l'en-tête `cf-r2-jurisdiction: eu` et confirme la métadonnée `jurisdiction=eu`. Un GET Cloudflare sans cet en-tête ne consulte que la juridiction par défaut et ne peut pas réfuter cette preuve.

Le workflow E2E live n'a pas été déclenché. La recette HTTP Pages → Worker n'est donc pas déclarée réussie.

## 2. D1 Preview — état observé en lecture seule

Base : `prochelia-preview-eu-2026-11-17`, UUID `e3cf167c-37e1-4d72-9ac6-b3e27c14b97f`, juridiction EU.

- 93 tables applicatives hors tables SQLite internes.
- 23 migrations enregistrées dans `d1_migrations`.
- `PRAGMA foreign_key_check` : aucun résultat.
- `PRAGMA integrity_check` via l'API D1 : refusé avec `SQLITE_AUTH`. Ce contrôle n'est pas revendiqué sur la base distante.
- Comptages observés : users 0, clients 0, intervenants 0, business_profiles 0, accounting_ledger 0, business_expenses 0, finance_workspace_entries 0, sessions 0 et wallets 0.
- Les tables `payment_transactions`, `payment_webhook_events`, `payment_disputes`, `payout_requests` et `payment_accounts` ne sont pas présentes dans cette base au moment du contrôle. Le code contient des créations de schéma à la demande ; cela ne remplace pas une migration versionnée et validée.

Aucune écriture, migration, seed ou modification de données n'a été faite durant cet audit.

## 3. Identité, appareils et sessions — risque élevé

Le code courant calcule `device_hash` comme SHA-256 de `user_id + User-Agent + sec-ch-ua`. Le parcours `securityPresence` enregistre automatiquement cet empreinte comme appareil de confiance. Ces en-têtes sont contrôlés par le client et falsifiables ; leur hash n'est pas une preuve cryptographique de possession d'une clé.

Le schéma `trusted_devices` ne contient pas de clé publique, d'identifiant de credential, de challenge consommable ni de preuve d'attestation. Il n'existe donc pas d'enrôlement cryptographique ou d'attestation matérielle démontrée.

Le schéma `sessions` contient `id, user_id, token_hash, expires_at, created_at`, sans colonne de révocation explicite. Le logout peut supprimer une session, mais un modèle de révocation/audit complet n'est pas démontré.

**Décision de sûreté :** la branche PR 287 retire le fingerprint UA et fait répondre `/api/security/presence` en 503 `DEVICE_ATTESTATION_REQUIRED` avant toute écriture tant que le challenge cryptographique n'existe pas. Prochaine étape : enrôlement WebAuthn ou clé publique liée au compte, challenge à usage unique, signature de présence, rotation/révocation et tests anti-rejeu. Une clé WebCrypto seule prouve la possession d'une clé, pas une attestation matérielle.

## 4. Webhooks et PSP — risque élevé

Le vérificateur actuel accepte `x-prochelia-signature` ou `x-webhook-signature`, calcule HMAC-SHA256 sur le corps brut et attend un digest base64url. Il n'analyse pas le format natif `Stripe-Signature` (`t=` et `v1=`), ne vérifie pas de fenêtre temporelle et n'établit pas de protection anti-rejeu temporelle.

Le récepteur refuse déjà les transitions financières nécessitant un règlement atomique. `paymentsConfigured()` retourne toujours `false`. Il n'y a donc pas d'adaptateur PSP réel ni de preuve Stripe Sandbox E2E.

**Décision de sûreté :** conserver les mouvements réels fermés. Avant toute intégration Sandbox, implémenter un adaptateur par fournisseur, vérification de signature native avec tolérance temporelle, déduplication persistée, liaison événement/transaction et tests de rejeu, doublon, ordre et montant.

## 5. Comptabilité et finance — non conformes à un grand livre

La définition actuelle de `accounting_ledger` est une ligne simple : `reference_type, reference_id, account_code, direction, amount_cents, currency, label, metadata_json`. Elle ne fournit pas un journal équilibré à deux lignes minimum, un identifiant de pièce comptable, une période, une entité juridique, une règle fiscale versionnée ou une preuve documentaire obligatoire.

La table `business_expenses` ne porte pas de `tenant_id` ni d'entité juridique. `finance_workspace_entries` n'est pas un grand livre légal. Aucun ensemble de tables de factures fournisseurs/clients, avoirs, relevés bancaires ou rapprochements n'a été trouvé dans le schéma D1 Preview.

Le tableau de synthèse existant agrège globalement transactions, dépenses et lignes de ledger, sans périmètre d'entreprise, de période ou de devise. Une ligne isolée ne constitue pas une écriture comptable équilibrée.

**Décision de sûreté :** la branche PR 287 retourne 503 pour la synthèse, le dashboard, les exports, les écritures manuelles et la création/résolution des problèmes financiers tant que le périmètre tenant/entité/période/devise et les preuves comptables ne sont pas établis. Les actions d'outbox comptables sont également bloquées tant qu'un journal équilibré, idempotent, réversible et approuvé n'existe pas. Aucune écriture ou déclaration comptable n'est autorisée par Nexus Supra.

Travail restant : entités juridiques séparées France/Algérie, plan de comptes et règles fiscales validés localement, pièces justificatives, partie double, écritures immuables et contrepassations, rapprochements bancaires/PSP, clôtures et exports réconciliés, revue d'expert-comptable.

## 6. Entreprises, réclamations, tarification et opérations

Le schéma `business_profiles` expose `owner_user_id`, mais aucun registre de membership d'entreprise avec rôles, dates d'effet, révocation et contrôle d'accès n'a été trouvé. Les événements `supra_audit_events` n'ont pas de `tenant_id` ni les mêmes triggers append-only que les événements d'approbation SUPRA.

Les branches de garde-fous déjà testées séparément (#278, #279, #280, #281 et #178) ont été portées dans une branche d'intégration empilée sur la PR 283 :
- synthèse financière : 503 tant que le périmètre tenant/devise/période n'est pas prouvé ;
- réclamations : 503 tant que le propriétaire client/entreprise/mission n'est pas résolu côté serveur ;
- devis : 503 tant que la politique tarifaire server-side par tenant n'est pas validée ;
- création/approbation/exécution des dossiers et actions d'outbox : 503 ou refus structuré tant que l'appartenance et les approbations liées à la ressource ne sont pas prouvées ;
- aucune écriture isolée dans l'ancien `accounting_ledger`.

Ces gardes réduisent le risque mais désactivent temporairement ces parcours. Elles ne remplacent pas l'implémentation du membership et des services métier.

## 7. Gouvernance NEXUS SUPRA

Les tables d'approbation disposent de contraintes sur le hash du payload, le tenant, les votes distincts et des triggers d'immutabilité/append-only. Le journal `supra_audit_events` reste à renforcer : tenant, chaînage ou scellement cryptographique, rétention, contrôle d'accès et preuve d'export.

NEXUS SUPRA peut analyser, calculer à partir de données sourcées, recommander et préparer des dossiers. Il ne doit pas décider seul d'une écriture comptable, d'une déclaration fiscale, d'un remboursement, d'un virement, d'un contrat, d'une suspension définitive ou d'une conclusion juridique.

## 8. Actions non effectuées et validations manquantes

- Aucun test HTTP live Pages → Worker n'a été lancé.
- Le déclenchement `workflow_dispatch` n'est pas exposé par la connexion GitHub utilisée ici.
- Le job frontend structural-smoke (run 44249829666) est en échec avant attribution d'un runner ; `steps=null`, `logs_url=null`, récupération des logs en `404 BlobNotFound`. Le contrôle n'a pas été supprimé.
- `main` est signalée `protected=false` par l'API des branches ; l'endpoint détaillé de protection n'est pas accessible avec la connexion actuelle.
- Aucun avis juridique, audit RGPD indépendant, validation d'expert-comptable, test de charge ou exercice de reprise complet n'est terminé.

**Conclusion : NO-GO Production.** Les gardes de cette branche doivent passer CI et être relues avant tout déploiement Preview. Aucun déploiement Production, paiement réel, seed réel, migration Production ou fusion n'est autorisé.
