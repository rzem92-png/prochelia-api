# PROCHÉLIA API — Référence routes financières (staging V14.5.1)

> Préproduction uniquement. Ce document ne constitue pas une autorisation de déploiement production ni d'activation des paiements réels.

## Routes et contrôles

| Route | Méthode | Contrôle / effet |
|---|---|---|
| /api/payments/onboard | POST | Authentification intervenant ; compte PSP attribué côté serveur |
| /api/payments/status | GET | Consultation authentifiée |
| /api/payments/mission/create | POST | Feature flag MISSION_API_ENABLED |
| /api/payments/mission/finalize | POST | Finalisation contrôlée par backend |
| /api/payments/payout | POST | Auth intervenant, flag PAYOUTS_ENABLED, contrôles d'éligibilité |
| /api/payments/dispute | POST | Ouverture litige |
| /api/payments/dispute/resolve | POST | Rôle gérante ; résolution administrative ne simule pas de règlement PSP |
| /api/payments/reconciliation | GET | Rôle gérante ; liste paginée (limit 1–100, offset 0–100000) |
| /api/payments/reconciliation/review | POST | Rôle gérante ; action confirm_reviewed, note obligatoire (10–1000 caractères), audit |
| /api/payments/provider-webhook | POST | Signature webhook provider requise |

## Réconciliation manuelle

### GET /api/payments/reconciliation
Paramètres :
- `limit` : 1–100, défaut 25
- `offset` : 0–100000, défaut 0

Retourne des champs sélectionnés (identifiant, provider, external ID, IDs internes, montant, devise, statut, date de vérification). Ne retourne pas les métadonnées brutes.

### POST /api/payments/reconciliation/review
Corps attendu :
```json
{
  "reconciliation_id": "identifiant",
  "action": "confirm_reviewed",
  "note": "Rapprochement contrôlé avec justificatifs..."
}
```

La route :
1. authentifie la gérante ;
2. vérifie les paramètres ;
3. charge l'élément ;
4. refuse les éléments déjà revus ;
5. écrit l'audit avant transition ;
6. marque l'élément reviewed avec condition de concurrence.

**Cette route ne libère pas de fonds, ne modifie pas le wallet, ne déclenche pas de payout et ne prouve pas que le PSP a effectivement réglé le montant.** Une revue manuelle n'est pas un rapprochement comptable final.

## Sécurité / production

- Les webhooks doivent rester signés et idempotents.
- Les paiements et payouts réels ne doivent pas être activés avant tests D1 et PSP Sandbox, vérification RBAC, rapprochement comptable et approbation humaine.
- Pas de migration D1 ni déploiement production dans ce bloc.
- Vérifier l'authentification, les rôles, l'ownership et les flags de chaque route lors de la recette d'intégration.

## Limites actuelles

- CI statique et tests source ne remplacent pas des tests d'intégration avec D1 réelle en préproduction.
- Stripe Sandbox n'a pas été exécuté par ce bloc.
- La revue humaine ne constitue pas une procédure complète de rapprochement de grand livre.
