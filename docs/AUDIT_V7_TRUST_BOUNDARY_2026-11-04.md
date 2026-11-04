# PROCHÉLIA — audit supplémentaire (2026-11-04)

## V7 : endpoints de validation publics

Lecture statique de `src/v7-routes.js` : les routes POST `/api/v7/check/permissions`, `/api/v7/check/document`, `/api/v7/check/mission`, `/api/v7/check/qr`, `/api/v7/check/payment`, `/api/v7/finance/calculate`, `/api/v7/security/audit` et `/api/v7/strategy/indicators` acceptent des données arbitraires du corps HTTP et appellent des fonctions V7 sans authentification/autorisation visible dans ce fichier.

### Risques
- `/check/permissions` peut renvoyer une décision favorable à partir d'un rôle/permissions fourni par le client. Ce résultat ne doit jamais être utilisé comme décision RBAC backend.
- `/check/document` et `/check/payment` valident des objets déclaratifs fournis par le client : ils ne prouvent ni vérification documentaire ni règlement PSP.
- `/security/audit` génère un audit en mémoire à partir de champs client : ce n'est pas un journal serveur fiable.
- `/strategy/indicators` accepte des métriques client : ne pas les traiter comme données financières/stratégiques de confiance.
- `/finance/calculate` reçoit montants et frais du client : calcul d'affichage seulement, jamais source de vérité d'une facture ou d'un paiement.

## Recommandation
- Distinguer validateurs purement pédagogiques/publics et opérations sensibles.
- Pour toutes décisions de confiance : session serveur + RBAC serveur + ownership DB + règles DB + journal durable.
- Les données documentaires doivent être confirmées par un fournisseur de vérification ou une validation humaine enregistrée.
- Les paiements doivent être confirmés par webhook PSP signé, idempotent, anti-rejeu et rapproché en base.
- Les événements d'audit et métriques doivent être générés côté serveur et stockés durablement.
- Ne jamais réutiliser les réponses V7 comme autorisation métier ou preuve de paiement/document.

## État
Audit statique seulement. Aucun test runtime, aucune requête D1, aucune modification de production, aucune migration et aucune fusion effectuées.