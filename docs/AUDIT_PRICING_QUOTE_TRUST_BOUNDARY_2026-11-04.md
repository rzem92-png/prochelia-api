# PROCHÉLIA — Audit pré-devis / calcul financier API (2026-11-04)

## Portée
Lecture statique de `src/index.js` sur `main`, notamment `pricingQuote` et `financeStrategicQuote`. Pas de requête runtime, pas de paiement, pas de migration, aucun changement de production.

## Constats de code
La route `pricingQuote` accepte des valeurs venant du body client, notamment:
- `base_price_cents`
- `distance_km`, `duration_minutes`
- `psp_percent`, `psp_fixed_cents`
- `software_cost_cents`
- `target_margin_percent`
- `platform_fee_percent`
- `intervenant_floor_cents`
- `regulated_max_cents`
- réductions, urgence, nuit/week-end/jour férié.

Le code essaie de charger une politique active depuis D1, mais plusieurs valeurs du payload client prennent priorité sur la politique DB. Le endpoint nécessite un rôle authentifié, mais authentification seule n'est pas suffisante: client/intervenant/entreprise ne doivent pas pouvoir choisir leurs paramètres économiques internes.

## Risque / implication
Un utilisateur autorisé pourrait tenter de modifier son propre devis ou d'influencer:
- prix client et frais,
- commission de la plateforme,
- minimum de rémunération intervenant,
- marge cible,
- plafond tarifaire,
- frais PSP et coût logiciel,
- remise et facteurs de prix.

Ce n'est pas une preuve de fraude ou d'exploit; c'est une surface de manipulation de paramètres. Le devis doit être déterminé par des règles serveur et une politique tarifaire versionnée.

## Remédiation proposée (ne pas appliquer sur main sans recette)
1. Séparer `/api/pricing/quote` public/UX (simulation non contractuelle) du devis officiel serveur.
2. Pour un devis officiel, accepter seulement les inputs métier minimaux: service code, zone/distance calculée ou confirmée serveur, durée/slot, client type établi depuis session, coupon/token validé.
3. Ignorer/rejeter les champs économiques client: commission, PSP, marge, floor intervenant, plafond, coûts logiciels, prix de base, discount arbitraire.
4. Charger politique depuis D1 (ou configuration signée), valider phase, version, dates, zone, service, type client, plafonds réglementaires.
5. Calculer avec entiers en centimes et règle d'arrondi documentée; garder une décomposition explicite des coûts.
6. Le serveur génère quote ID + hash/version + expiration; création mission/paiement doit référencer cette quote immuable.
7. Le paiement PSP doit utiliser exactement le montant autoritatif du quote validé, jamais un montant recalculé ou fourni par le navigateur.
8. Ajouter tests: prix manipulé, rôle client, rôle intervenant, entreprise, coupon expiré, policy inactive, tarifs simultanés, devis expiré, double submit, devise et overflow/NaN/Infinity, distances négatives/excessives, concurrence et arrondis.

## Questions mathématiques à valider avant déploiement
- `commission_cents` est calculée sur `service`, alors que le prix client peut inclure déplacement et uplift de marge: vérifier la base de commission contractuelle.
- Si plafond réglementaire bloque l'uplift, le devis renvoie `ADJUST_OR_ESCALATE`; l'appelant doit effectivement refuser/faire valider, pas simplement afficher le quote comme payable.
- La formule de marge exclut/inclut certains coûts de transport selon ses variables: faire valider la formule comptable et fiscale par expert comptable.
- `fuel_cost_per_km_cents` legacy est calculé mais le quote expose `strategic.travel.total_cost_cents`: vérifier compatibilité des clients consommateurs.
- Aucun taux ou marge proposé ici n'est une validation juridique/comptable de la tarification.

## Conclusion
Le devis API est un point **bloquant avant production réelle** tant que les paramètres économiques contrôlés par le client ne sont pas isolés, et que la quote officielle n'est pas immutable, versionnée et utilisée telle quelle au paiement. Audit statique uniquement.
