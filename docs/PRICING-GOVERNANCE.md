# PROCHÉLIA — Gouvernance du moteur de tarification

## Principe non négociable
Le navigateur ne décide jamais du prix final. Le serveur calcule chaque devis à partir d'une prestation active, de son tarif de référence serveur, d'une politique de tarification active et des paramètres financiers contrôlés.

## Sources de vérité
- Catalogue serveur `métier_catalog` : la prestation doit exister, être active et porter un `rules_json.base_price_cents` entier strictement positif.
- `pricing_policies` : politique active par phase, type de clientèle et prestation, avec commission, frais PSP, marge cible, plancher intervenant et plafond éventuel.
- `platform_settings` : phase projet, paramètres techniques et calendrier des jours fériés français.
- L'identité du rôle authentifié détermine le type B2C/B2B ; un client ne peut pas se déclarer entreprise dans le corps de sa requête.
- Le devis n'est qu'une estimation. Le prix de mission doit être recalculé et figé côté serveur au moment de la confirmation.

## Règles de sécurité
- Refuser les prestations absentes/inactives ou sans tarif serveur.
- Ne jamais accepter du navigateur le tarif de base, la commission, les frais PSP, la marge, le plancher intervenant, le plafond réglementaire ou une remise.
- Les remises sont nulles par défaut ; seule une promotion validée côté serveur pourra les appliquer.
- Déduire les majorations de l'horodatage de mission avec le fuseau `Europe/Paris`, jamais des cases à cocher du navigateur.
- Exiger un horodatage ISO avec fuseau pour calculer les majorations calendaires.
- Refuser les politiques financières invalides ou incohérentes.
- En dehors de la phase `TEST`, refuser les devis tant qu'une politique complète et approuvée n'est pas configurée.
- Enregistrer les hypothèses avec le devis pour permettre l'audit et le rapprochement.

## Éléments restant à valider avant ouverture
1. Renseigner et contrôler les tarifs de référence pour chaque prestation active.
2. Configurer les politiques B2C et B2B par phase, zone et prestation.
3. Vérifier les frais PSP contractuels, les coûts logiciels et le coût de déplacement.
4. Configurer et vérifier le calendrier officiel des jours fériés.
5. Tester les cas limites : plafond inférieur au coût, marge négative, mission de nuit, dimanche, jour férié, urgence, annulation et changement d'horaire.
6. Recalculer le devis côté serveur au moment de la réservation et empêcher toute modification rétroactive non auditée.
7. Rapprocher devis, facture, paiement PSP, reversement intervenant, commission et ledger.

## Limite actuelle
Le moteur de devis n'est pas une autorisation de paiement et ne déclenche aucun prélèvement ni reversement. Les adaptateurs PSP, les tests sandbox et le rapprochement financier réel doivent être validés séparément avant toute mise en production.
