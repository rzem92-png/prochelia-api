# PROCHÉLIA — Modèle économique, rentabilité et contrôle financier

**État : spécification de préproduction, à valider par la Gérante, l'expert-comptable et le conseil juridique.**

## 1. Trois comptes de valeur à ne jamais confondre

- **Volume d'affaires (GMV)** : sommes payées ou dues par les clients pour les prestations et frais inclus.
- **Revenu plateforme** : commission contractuelle réellement acquise par PROCHÉLIA, après prise en compte de la part de commission remboursée.
- **Marge contributive** : revenu plateforme conservé moins frais PSP et autres coûts variables directement attribuables.
- **Résultat d'exploitation** : marge contributive moins charges fixes, salaires/charges éventuels, assurance, hébergement, acquisition, conseil, comptabilité, fiscalité et autres coûts réels.

Le chiffre d'affaires encaissé pour le compte d'un intervenant n'est pas automatiquement le chiffre d'affaires de PROCHÉLIA. La qualification comptable et TVA doit suivre les contrats et le rôle réellement exercé par la plateforme.

## 2. Formules de pilotage par mission

En centimes :
- client_total = prestation_apres_remise + frais_deplacement_factures
- commission_brute = part_fixe + part_variable_contractuelle
- intervenant_net = prestation_eligible - commission_brute selon le modèle contractuel retenu
- commission_conservee = commission_brute × (1 - remboursement_prestation / prix_prestation)
- marge_contributive = commission_conservee - frais_PSP - autres_couts_variables_plateforme
- resultat_mission_apres_allocation = marge_contributive - allocation_couts_fixes

Les frais de déplacement ne doivent être intégrés au revenu plateforme que si le contrat, la facturation et la réalité opérationnelle le justifient. Leur propriété économique et la prise en charge du coût du trajet doivent être explicites. Le modèle ne doit jamais supposer que la commission est égale à la marge.

## 3. Règles de rentabilité protectrices

- Prix total connu du client avant validation.
- Montant et modalités de rémunération visibles par l'intervenant avant acceptation.
- Aucun rabais hors promotion approuvée et dans le budget.
- Aucun tarif en dessous du plancher de rémunération convenu.
- Aucun devis si le coût essentiel, la règle de déplacement ou le plafond réglementaire est inconnu.
- Une marge négative ou inférieure au plancher déclenche une revue, jamais une augmentation opaque du prix ou une baisse automatique de rémunération.
- La tarification varie selon service, zone, durée, horaire, calendrier, coûts et cadre réglementaire vérifiés.
- Les prévisions affichent une hypothèse prudente à croissance nulle tant qu'une tendance fiable n'est pas démontrée.

## 4. Grand livre portefeuille append-only

La migration 0004_atomic_wallet_ledger.sql introduit payment_wallet_ledger :
- une clé d'idempotence unique par mouvement ;
- des deltas signés par compartiment disponible, en attente, réservé et payé ;
- un trigger qui applique le mouvement au portefeuille dans la même transaction SQLite ;
- des triggers qui interdisent la modification et la suppression des écritures.

Les webhooks de paiement et de remboursement utilisent D1 batch pour grouper les transitions de transaction et les écritures de ledger. Les réservations et règlements de versements utilisent aussi des clés déterministes. Les remboursements partiels sont rapprochés par cumul et les événements arrivant dans le désordre peuvent être réconciliés lors de la confirmation du paiement.

**Limite à traiter avant production :** vérifier la politique de solde négatif/dette intervenant, les fonds déjà versés, les contestations et les réserves PSP. Le ledger ne remplace pas un rapprochement bancaire, un relevé PSP ni une comptabilité validée.

## 5. Indicateurs de rentabilité

| Indicateur | Définition |
|---|---|
| GMV réglé | Volume des transactions réglées, net des remboursements client |
| Commission brute | Commission prévue/contractuelle sur les transactions réglées |
| Commission conservée | Commission diminuée de sa part remboursée |
| Frais PSP | Frais réellement facturés par le prestataire |
| Marge contributive plateforme | Commission conservée − frais PSP − autres coûts variables tracés |
| Coût d'acquisition client | Dépenses d'acquisition attribuables / nouveaux clients acquis |
| Valeur client | Marge contributive cumulée, pas seulement volume de commandes |
| Coût de recrutement | Dépenses et temps d'intégration attribuables par intervenant activé |
| Rétention intervenant | Part des intervenants actifs encore actifs à 30/90/180 jours, selon définition stable |
| Coût de non-qualité | Remboursements, litiges, reprises, support et pertes attribuables aux incidents |

Les tableaux de bord doivent distinguer valeurs réelles, estimations, prévisions et données manquantes. Les frais fixes non renseignés ne peuvent pas être considérés comme nuls.

## 6. Copilote transversal — données et limites

Le Copilote reçoit désormais une photographie D1 en lecture seule :
- pour la Gérante : agrégats financiers, portefeuille global, pipeline commercial, pipeline recrutement, réclamations, dossiers opérationnels et qualité ;
- pour un client : uniquement ses agrégats de paiements et réclamations ;
- pour un intervenant : uniquement son propre portefeuille et ses demandes de versement.

Aucune donnée nominative, pièce d'identité, adresse, IBAN ou donnée de santé n'est envoyée dans ce contexte agrégé. Le modèle ne peut ni écrire en base, ni appeler Stripe, ni exécuter du SQL ou une action métier. Les actions passent par des routes déterministes, contrôles RBAC, approbations et reçus vérifiés.

## 7. Conditions de mise en production

1. Valider le rôle juridique et comptable réel de PROCHÉLIA.
2. Valider le modèle de facturation, TVA, commission, déplacement et remboursements.
3. Valider les règles de plafonds et d'éligibilité service par service.
4. Réconcilier un échantillon complet : devis, paiement PSP, commission, wallet, remboursement, versement, relevé bancaire et écritures comptables.
5. Tester événements PSP dupliqués, concurrents, retardés, désordonnés et interrompus.
6. Définir le traitement des soldes négatifs, litiges, réserves et sommes déjà payées.
7. Renseigner les charges réelles et les coûts d'acquisition/recrutement pour obtenir une marge complète.
8. Réaliser recette des trois espaces, tests de charge, sauvegarde/restauration et audit de sécurité.
9. Faire valider les contrats et documents juridiques par les professionnels compétents.

Aucun de ces points ne doit être marqué terminé sur la seule base d'une réponse du Copilote.
