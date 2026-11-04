# PROCHÉLIA — Notifications e-mail gratuit + WhatsApp

**Scope décidé :** e-mail (Resend Free) et WhatsApp Business Platform (Meta Cloud API). SMS et Viber sont exclus de la première version.  
**Branche:** `feature/multichannel-notifications-v1`  
**Statut:** adaptateurs isolés en développement; aucun déploiement ni message réel.

## Fournisseurs

### E-mail transactionnel
- Resend Free en premier choix (activation OTP, récupération du compte, confirmations et notifications non marketing).
- L’offre gratuite et les quotas sont à revalider au moment du lancement.
- Variables Cloudflare Worker Secrets : `RESEND_API_KEY`.
- Variable non-secrète : `EMAIL_FROM` (adresse expéditeur vérifiée).
- Domaine d’envoi à authentifier (SPF/DKIM, DMARC recommandé).
- L’envoi gratuit dépend de la limite du compte; ne jamais garantir l’absence de coût au-delà du quota.

### WhatsApp
- Meta WhatsApp Business Platform Cloud API directement, sans ajouter un BSP payant par défaut.
- Variables Cloudflare Worker Secrets : `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (webhook validation à implémenter).
- Variable : `WHATSAPP_API_VERSION` (version Graph API validée), jamais utiliser une version obsolète sans vérification.
- L’entreprise doit créer/valider le compte Business, le numéro, les permissions et les templates WhatsApp nécessaires.
- WhatsApp nécessite un opt-in clair. Les messages initiés par l’entreprise hors fenêtre de service client requièrent un template approuvé. Respecter la fenêtre de 24 heures, règles de templates, opt-out et coûts applicables.
- Pas de message réel tant que compte Meta, numéro, templates et secrets ne sont pas validés.

## Routage

- OTP signup et reset password : e-mail en priorité.
- WhatsApp n’est **pas** un canal de récupération de compte par défaut. Activation optionnelle pour notifications de réservation/sécurité après vérification du numéro et consentement explicite.
- Aucun fallback automatique e-mail→WhatsApp pour OTP : le destinataire doit choisir et avoir consenti; éviter doubles messages.
- WhatsApp transactionnel avec template approuvé si nécessaire. Marketing est séparé et nécessite consentement spécifique.
- Le backend reste la seule autorité pour génération, validation, expiration et consommation des OTP.

## Sécurité

- OTP généré par CSPRNG, stocké uniquement sous forme de hash/HMAC, durée courte, usage unique, compteur d’essais, throttling et cooldown.
- Pas de code OTP, token, contenu sensible, e-mail ou téléphone en clair dans logs.
- Réponse générique pour reset password (anti-enumeration).
- Secrets dans Cloudflare Worker Secrets seulement; jamais dans code, HTML, GitHub, localStorage ou D1.
- Les templates n’affichent pas de données sensibles sur écran verrouillé.
- Idempotence des notifications et gestion des erreurs provider sans retry en boucle.
- RBAC: inscription publique ne peut jamais créer un compte Gérante/Admin.

## RGPD / consentement

- E-mail transactionnel séparé du consentement marketing.
- WhatsApp : opt-in explicite et traçable (date, source, finalité, version du texte), opt-out accessible.
- Minimisation des journaux et durée de conservation documentée.
- Vérifier sous-traitance, DPA, transferts internationaux, politique de confidentialité et conformité Meta avant activation réelle.

## Tests de préproduction

- Mock provider d’abord, sans requête externe.
- Email: OTP, expiration, retry, quotas, erreurs API, sender non vérifié.
- WhatsApp: opt-in absent/retiré, numéro non valide, template absent/non approuvé, erreur/timeout, webhook signature et rejeu.
- Anti-enumeration, OTP one-time, rate-limit, cooldown, idempotence, double-submit, logs secrets.
- Tests d’intégration réels uniquement sur compte de test Meta et adresses allowlistées, avec validation humaine.

## Étapes de livraison

1. Provider adapters isolés (Resend + Meta Cloud API).
2. Tests unitaires avec mocks et vérification syntaxique.
3. Connexion à la logique OTP/reset/signup backend et routes auth — sans migrations D1 prod.
4. Préproduction avec secrets séparés et comptes sandbox/test.
5. Validation de bout en bout.
6. Activation réelle après validation explicite.

## Documentation officielle
- Resend pricing: https://resend.com/pricing
- Resend API: https://resend.com/docs/api-reference/emails/send-email
- Meta WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
- WhatsApp opt-in: https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/
- WhatsApp templates: https://developers.facebook.com/docs/whatsapp/message-templates/
