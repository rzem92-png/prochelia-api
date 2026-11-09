# PROCHÉLIA — Contrat d'adaptateur PSP

**Statut : spécification technique, non implémentée et non autorisante.**  
**Cible : préproduction isolée uniquement tant que les gates de release ne sont pas signés.**

Ce contrat définit la frontière entre le ledger métier PROCHÉLIA et un prestataire de paiement (PSP). Il ne choisit pas le montage juridique/financier, ne sélectionne pas un produit Stripe, et n'active aucun encaissement.

## 1. Principes non négociables

- Le PSP agréé traite les fonds ; PROCHÉLIA conserve les intentions métier, le ledger, les règles d'autorisation et l'audit.
- Les montants sont des entiers en centimes, avec devise explicite et liste de devises autorisées par pays.
- Le serveur relit mission, client, intervenant, prix, commission, devise et éligibilité depuis D1. Aucune donnée financière fournie par le navigateur n'est autoritaire.
- Une réponse navigateur, une redirection de succès ou un retour d'application ne prouve jamais qu'un paiement est encaissé.
- Seuls un webhook authentifié et vérifié, ou une interrogation serveur-à-serveur du PSP, peuvent établir un état PSP.
- Toute opération PSP est liée à une intention métier persistée et à une clé d'idempotence stable, générée côté serveur à partir de l'identifiant interne et du type d'opération.
- Le ledger financier est append-only. Aucun handler PSP ne modifie directement les soldes des wallets.
- Toute ambiguïté, incohérence de montant/devise/référence, transition inconnue ou panne de rapprochement entraîne un état bloqué/quarantaine, jamais une réussite supposée.
- Les secrets restent dans le gestionnaire de secrets du runtime. Ils ne sont jamais renvoyés au navigateur, journalisés ou copiés dans Git.

## 2. Interface minimale

L'adaptateur doit exposer une interface interne indépendante du fournisseur :

| Opération | Entrée normalisée | Résultat normalisé |
|---|---|---|
| `createCharge` | transaction interne, montant, devise, compte payeur/token PSP, clé idempotente | référence PSP, état, éventuelle action client requise |
| `getCharge` | référence PSP | état PSP vérifié, montant, devise, horodatage |
| `captureCharge` | référence PSP, montant capturable, clé idempotente | état capturé et référence |
| `cancelCharge` | référence PSP, clé idempotente | état annulé ou refus explicite |
| `createRefund` | transaction, montant remboursé, motif, clé idempotente | référence de remboursement et état |
| `getRefund` | référence PSP | état vérifié, montant, devise |
| `createPayout` | payout interne, compte connecté vérifié, montant, devise, clé idempotente | référence PSP, état |
| `getPayout` | référence PSP | état vérifié, montant, devise |
| `getConnectedAccount` | identifiant PSP persisté | capacités, exigences, restrictions, horodatage |
| `verifyWebhook` | en-têtes et corps brut | identité d'événement vérifiée, type, horodatage, hash |
| `reconcile` | fenêtre temporelle / références internes | écarts typés, jamais de correction silencieuse |

Les méthodes ne doivent pas accepter de chemin HTTP arbitraire, d'URL, d'en-tête d'autorisation, d'identifiant de compte fourni librement par le client ou de montant recalculé côté navigateur.

## 3. Modèle de données et machine à états

Chaque intention de charge, remboursement et versement possède :
- un identifiant interne immuable ;
- un acteur et une ressource métier propriétaires ;
- un montant en centimes et une devise ;
- une clé d'idempotence interne unique par opération ;
- une référence PSP unique quand elle existe ;
- un état interne et un état PSP distincts ;
- les horodatages de création, dernière vérification et terminalisation ;
- les événements entrants, leur hash et leur résultat de traitement ;
- une trace d'audit sans données de carte ni secret.

Les états PSP bruts sont convertis par une table explicite et versionnée. Un état fournisseur inconnu ne doit jamais être converti en `paid`, `completed` ou `refunded`.

Transitions métier minimales :
- charge : `created → pending/action_required → authorized → paid`, ou `failed/canceled` ;
- remboursement : `requested → pending → succeeded/failed` ;
- payout : `requested → pending/processing → completed/failed/canceled` ;
- litige : `open → evidence_required/under_review → won/lost/closed`.

Les transitions réelles dépendent des capacités du PSP choisi. Les états terminaux ne reviennent pas en arrière ; toute correction passe par une nouvelle opération compensatoire, auditée.

## 4. Traitement d'un encaissement

1. Authentifier l'acteur et vérifier son rôle, l'ownership, l'état de la mission et les conditions d'éligibilité.
2. Relire les prix et parties depuis D1 ; vérifier l'équation comptable et les plafonds.
3. Créer l'intention interne et son audit dans une transaction D1 atomique.
4. Appeler le PSP avec une clé d'idempotence déterministe dérivée de l'intention persistée.
5. Persister la référence PSP et l'état non terminal. En cas de timeout ambigu, marquer `reconciliation_required` et interdire la création d'une nouvelle charge.
6. Traiter le webhook dans une inbox durable : vérification de signature sur le corps brut, fenêtre temporelle, identifiant, hash, déduplication, lease de traitement et reprise.
7. Vérifier auprès du PSP les événements sensibles ou ambigus, puis contrôler référence, montant, devise, compte et état attendu.
8. Dans un batch D1 atomique : transition conditionnelle, écriture ledger via triggers, audit et marquage de l'événement traité.
9. Si un litige ou gel existe, les fonds restent réservés et ne deviennent jamais disponibles au payout.
10. Réconcilier périodiquement les états internes et les états PSP.

Un webhook invalide reçoit un refus. Un événement valide mais prématuré/incomplet reste rejouable et n'est pas marqué traité. Un événement dupliqué avec le même hash est idempotent ; le même identifiant avec un hash différent est mis en quarantaine.

## 5. Remboursements, litiges et versements

### Remboursements
- Vérifier la somme déjà remboursée, le solde remboursable et l'absence de dépassement du montant encaissé.
- Persister une demande de remboursement avant l'appel PSP.
- Utiliser une clé d'idempotence distincte par remboursement.
- Ne déclarer le remboursement terminé qu'après confirmation PSP vérifiée.
- Comptabiliser le remboursement par écritures compensatoires append-only ; ne jamais effacer ni réécrire l'encaissement initial.
- Gérer explicitement les remboursements partiels, les remboursements multiples, les échecs et les délais de règlement.

### Litiges
- Geler immédiatement la somme contestée selon une politique validée, avec trace de l'origine et de la portée du gel.
- Ne pas libérer automatiquement les fonds à la seule réception d'une réponse client ou d'un événement navigateur.
- Toute résolution ayant un impact financier exige une preuve PSP et, selon le cas, une validation humaine.

### Versements
- Vérifier l'identité, l'état du compte connecté, les capacités de versement, la devise, les restrictions et le solde disponible.
- Réserver le montant par le ledger avant l'appel PSP.
- Envoyer le payout avec une clé idempotente stable.
- En cas de timeout ambigu, conserver la réservation et réconcilier avant toute nouvelle tentative.
- Ne passer à `completed` qu'après confirmation PSP vérifiée ; en cas d'échec définitif, libérer la réservation par écriture compensatoire.

## 6. Comptabilité et rapprochement

Le rapprochement doit couvrir au minimum :
- charges créées, autorisées, capturées, échouées et annulées ;
- remboursements totaux et partiels ;
- frais PSP réellement prélevés ;
- commissions PROCHÉLIA ;
- montants dus aux intervenants ;
- payouts demandés, en cours, réussis et échoués ;
- réserves, litiges, chargebacks et soldes négatifs ;
- écarts entre ledger PROCHÉLIA, rapports PSP et mouvements bancaires disponibles.

Chaque écart est classé (montant, devise, référence, état, frais, délai, compte) et donne lieu à un dossier de rapprochement. Aucune écriture correctrice automatique sans règle explicite, idempotence, approbation si nécessaire et audit.

## 7. Responsabilités et décision préalable

Avant toute activation, la direction doit valider par écrit :
- modèle de paiement adapté à la prestation et au pays ;
- qui est vendeur/prestataire contractuel et qui encaisse ;
- qui supporte les frais PSP, remboursements, chargebacks, soldes négatifs et pertes ;
- règles de commission, taxes, facturation et délais de versement ;
- conditions d'éligibilité et documents des intervenants ;
- parcours client, consentements, conditions contractuelles et traitement des réclamations.

Ces choix nécessitent une revue juridique, fiscale, comptable et opérationnelle adaptée au pays. Le code ne doit pas les déduire automatiquement du type de compte Connect.

## 8. Tests obligatoires avant activation

### Tests unitaires et contractuels
- chaque méthode, validation d'entrée, erreur PSP, timeout et réponse malformée ;
- clés d'idempotence stables et conflits de payload ;
- mapping de tous les états et refus des états inconnus ;
- signature invalide, signature expirée, corps modifié, événement dupliqué et collision de hash.

### Tests d'intégration sandbox
- paiement réussi, refusé, action client requise, expiration, annulation ;
- webhooks dupliqués, retardés, désordonnés, rejoués et simultanés ;
- panne avant/après réponse PSP, reprise après crash et lease expirée ;
- remboursement total/partiel, échec et retry ;
- payout réussi/échoué, compte restreint, solde insuffisant et timeout ambigu ;
- litige avant et après règlement ;
- rapprochement avec frais et écarts.

### Tests D1 et résilience
- concurrence multi-worker sur une même intention et un même payout ;
- atomicité/rollback du batch ;
- absence de double crédit/débit ;
- ledger append-only et contraintes de transition ;
- reprise après redémarrage et réconciliation idempotente.

### Garde de release
Aucun trafic réel avant que les tests soient verts sur un SHA unique, que le test complet de restauration soit démontré, que les parcours iOS/Safari soient acceptés, que les validations France soient signées et que l'approbation explicite de déploiement soit enregistrée. Les clés live ne sont jamais utilisées pour les tests.

## 9. État actuel constaté

Au moment de la rédaction :
- le runtime PROCHÉLIA n'a pas d'adaptateur de charge/payout activable ;
- `paymentsConfigured()` retourne `false` ;
- les routes de paiement réel répondent en mode fermé ;
- la migration de ledger 0006 est proposée dans la PR #124 mais n'est pas déclarée appliquée à D1 ;
- les PR #124 et #125 sont divergées et doivent être consolidées avant validation combinée ;
- la préproduction PSP E2E, le test de restauration complet, la recette Safari/iOS et les validations juridiques/opérationnelles restent à produire.

**Conclusion : NO-GO pour les paiements et le trafic transactionnel de production.** Ce contrat est un plan d'implémentation et de vérification, pas une preuve de conformité ni une autorisation de mise en service.
