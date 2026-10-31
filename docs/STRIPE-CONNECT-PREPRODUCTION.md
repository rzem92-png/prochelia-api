# Stripe Connect — configuration de préproduction PROCHÉLIA

## État fonctionnel

Cette intégration prépare l'ouverture du parcours Stripe Connect pour les intervenants :
- création serveur d'un compte connecté via Stripe Accounts v2 ;
- création d'un lien d'onboarding à durée limitée ;
- synchronisation de l'état du compte par webhook signé ;
- aucune donnée bancaire saisie ou stockée par PROCHÉLIA.

**Les paiements clients et les versements automatiques restent désactivés dans le code.** Les adaptateurs PaymentIntent et payout ne sont pas encore implémentés. Ne pas annoncer l'encaissement ni le paiement des intervenants comme disponibles.

## Variables Cloudflare du Worker

Dans Cloudflare Dashboard → Workers & Pages → Worker `prochelia-api` → Settings → Variables and Secrets :

Variables :
- `PAYMENT_PROVIDER` = `stripe`
- `APP_BASE_URL` = origine HTTPS exacte de l'application, par exemple `https://prochelia.pages.dev`
- `CORS_ORIGIN` = liste séparée par des virgules des origines autorisées, sans wildcard
- `STRIPE_DASHBOARD` = `express` ou `full`
- `STRIPE_FEES_COLLECTOR` = `application` ou `stripe`
- `STRIPE_LOSSES_COLLECTOR` = `application` ou `stripe`

Secrets :
- `STRIPE_SECRET_KEY` = clé API Stripe de test en préproduction
- `STRIPE_WEBHOOK_SECRET` = secret de signature du webhook Stripe

Ne jamais placer ces secrets dans GitHub, dans `index.html`, dans une capture d'écran ou dans une conversation.

## Choix financier obligatoire avant l'onboarding

Avec le tableau de bord `express`, Stripe exige que les responsabilités de frais et de pertes soient portées par la plateforme :
- `STRIPE_FEES_COLLECTOR=application`
- `STRIPE_LOSSES_COLLECTOR=application`

Cela signifie que PROCHÉLIA supporte les frais concernés et peut être responsable des soldes négatifs/ pertes sur les comptes connectés. Ce choix doit être validé par la gérante et par l'analyse juridique/financière avant activation.

Le mode `full` et les responsabilités attribuées à Stripe ne doivent pas être choisis automatiquement : ils peuvent changer le modèle de paiement, l'expérience de l'intervenant et la compatibilité avec les transferts marketplace. Ne pas modifier ces paramètres sans valider le flux de paiement cible.

## Webhook Stripe

Endpoint à enregistrer dans le compte Stripe de plateforme :

`https://prochelia-api.rzem92.workers.dev/api/payments/webhook`

Événement nécessaire pour le suivi de l'onboarding Accounts v2 :
- `v2.core.account[requirements].updated`

Copier le secret de signature fourni par Stripe dans `STRIPE_WEBHOOK_SECRET`. Le Worker vérifie l'en-tête `Stripe-Signature`, la signature HMAC et la fraîcheur de l'événement avant les écritures métier.

## Recette avant toute clé live

1. Configurer uniquement des clés Stripe de test.
2. Vérifier que `APP_BASE_URL` correspond exactement à une origine de `CORS_ORIGIN`.
3. Connecter un compte intervenant de test.
4. Vérifier le retour Stripe et l'événement webhook `v2.core.account[requirements].updated`.
5. Vérifier que le compte est indiqué actif seulement lorsque la capacité de transfert est active.
6. Laisser les paiements et versements désactivés tant que les parcours de charge, remboursement, transfert, rapprochement et litige ne sont pas implémentés et testés.

Aucun déploiement production ni aucune clé live n'est autorisé par ce document.
