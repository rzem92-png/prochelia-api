# PROCHÉLIA — architecture de notifications multicanales v1

**Statut :** spécification intégrée sur branche de fonctionnalité, non déployée.  
**Objectif :** e-mail, SMS au coût maîtrisé, WhatsApp Business et Viber, avec consentement, sécurité et routage par canal.

## Décision d’architecture

Créer une interface métier unique `NotificationService` et des adaptateurs isolés :
- `EmailProvider` : Resend en pilote (API transactionnelle). Brevo peut rester un adaptateur de remplacement.
- `SmsProvider` : interface interchangeable. Ne pas figer un fournisseur avant comparaison réelle des prix France + pays cible, frais de numéro, sender ID, taxes, échecs et coûts de vérification.
- `WhatsAppProvider` : WhatsApp Business Platform via BSP (Vonage/Twilio/Bird à comparer) ; modèles approuvés pour messages initiés par l’entreprise.
- `ViberProvider` : Viber Business Messages via fournisseur/BSP compatible (tarifs et disponibilité à valider par pays et compte).
- `NotificationRouter` : décide du canal selon type de notification, pays, consentement, disponibilité, coût et statut de délivrance.

## Politique d’usage / coût

1. E-mail gratuit ou à très faible coût par défaut pour activation de compte, récupération de mot de passe, reçus et notifications non urgentes.
2. SMS **fallback uniquement** pour OTP ou urgence de sécurité quand l’e-mail/WhatsApp n’est pas disponible, ou quand l’utilisateur a choisi le SMS. Limiter les envois par compte, IP, numéro, pays et fenêtre de temps.
3. WhatsApp : opt-in explicite, numéro vérifié, modèle adapté et statut opt-out respecté. Utiliser en priorité les messages utilitaires; ne pas envoyer de marketing sans consentement approprié.
4. Viber : opt-in séparé; utiliser seulement si l’utilisateur a un numéro/compte joignable et que la route est disponible dans son pays. Fallback vers e-mail, puis SMS si policy l’autorise.
5. Pas de SMS automatique en cascade après chaque échec de canal : risque de doublons et de coûts. Un seul fallback, avec idempotence et règles précises.
6. Afficher au client un choix de canaux et une gestion des préférences. Les messages strictement nécessaires à la sécurité et aux obligations légales doivent être séparés des messages marketing.

## OTP et authentification (sécurité)

- OTP aléatoire cryptographiquement sûr; stocker uniquement un hash (HMAC avec secret serveur ou hash robuste), jamais le code en clair.
- OTP à usage unique, lié à une finalité précise (signup, reset, vérification téléphone), expiration courte configurable (ex. 5 min), compteur de tentatives et invalidation après usage.
- Rate limits par IP, identifiant de compte, téléphone, pays et appareil; cooldown de renvoi; plafonds quotidiens et détection d’abus/SMS pumping.
- Ne jamais confirmer si un compte existe : réponse uniforme sur récupération de compte.
- Le code OTP ne doit jamais être inclus dans logs, analytics, exceptions ou traces.
- Sessions révoquées selon politique après reset du mot de passe; alertes de sécurité sans divulguer de secrets.
- Aucun rôle Gérante/Admin assignable via inscription publique. Invitation/bootstrap administrateur protégé et audité.
- Ne pas utiliser SMS ou WhatsApp comme facteur unique de récupération pour comptes privilégiés; exiger contrôle renforcé.

## Données / RGPD

- Stocker préférences de canal, consentement, source/date/texte/version du consentement, langue et événements de délivrance minimaux.
- Séparer consentement marketing et messages transactionnels.
- Minimiser la conservation des journaux; ne pas loguer OTP, tokens, contenu sensible, ni téléphone/e-mail complet (masquage).
- Droit d’opposition/opt-out pour marketing; désinscription par canal; suppression/anonymisation conforme à la politique de conservation.
- Les notifications ne doivent pas révéler détails de santé, prestations sensibles ou informations confidentielles sur écran verrouillé.
- Évaluer transferts internationaux, DPA/sous-traitants, hébergement et clauses avant activation réelle de chaque fournisseur.

## Contrat API interne proposé

```ts
type Channel = "email" | "sms" | "whatsapp" | "viber";
type NotificationPurpose =
  | "signup_otp" | "password_reset" | "phone_verification"
  | "security_alert" | "booking_update" | "receipt" | "marketing";

interface NotificationRequest {
  idempotencyKey: string;
  userId?: string;
  destination: string;
  channelPreference?: Channel[];
  purpose: NotificationPurpose;
  locale: string;
  templateId: string;
  variables: Record<string, string>;
  expiresAt?: string;
}

interface NotificationResult {
  accepted: boolean;
  provider: string;
  channel: Channel;
  providerMessageId?: string;
  status: "queued" | "sent" | "delivered" | "failed" | "fallback";
}
```

- Les OTP et secrets ne passent pas par des templates frontend ni des logs.
- Idempotency key obligatoire pour prévenir les doubles envois.
- Le statut `accepted` signifie accepté par le fournisseur, pas délivré.
- Webhooks fournisseur : signature vérifiée, anti-rejeu, déduplication.

## Secrets et environnements

- Secrets exclusivement dans Cloudflare Worker Secrets (ex. `RESEND_API_KEY`, clés SMS/BSP), jamais dans HTML, localStorage, repo ou variables publiques.
- Config distincte dev / préproduction / production; credentials et numéros de test séparés.
- En production, limites de dépenses, alertes d’usage, allowlist des destinations pendant les tests et kill switch par fournisseur.
- Aucun vrai message, secret fournisseur, migration D1 ou déploiement n’est effectué par cette spécification.

## Tests obligatoires avant activation

- OTP correct/incorrect/expiré/réutilisé, cooldown, max attempts, resend, brute force et enumeration.
- OTP même code non utilisable pour une autre finalité ou autre utilisateur.
- Consentement absent/retiré, opt-out, canal indisponible, route pays non supportée.
- Échec fournisseur, timeout, webhook dupliqué/falsifié, fallback, retry et idempotence.
- Tests de coût/plafonds et SMS pumping; tests sans envoi réel puis canary limité après validation humaine.
- Test de confidentialité: aucun code, token, contenu privé ni identifiant complet dans les logs.
- Tests multilingues et templates approuvés WhatsApp/Viber.

## Déploiement progressif

1. Mock providers + tests unitaires.
2. Email transactionnel en préproduction.
3. SMS sandbox/numéros allowlistés et plafond strict.
4. WhatsApp Business test account + templates approuvés.
5. Viber test/sandbox si disponible.
6. Canary contrôlé, métriques coûts/délivrance et validation humaine.
7. Production uniquement après validation explicite.

## Comparaison fournisseur à faire avant choix final

Comparer les prix actuels au pays de destination, les frais opérateur, la route OTP, les frais d’échec, l’achat/location d’un numéro, l’enregistrement Sender ID, les restrictions pays, l’assistance et les exigences RGPD. Les prix publics ne sont pas une garantie de coût final.

**Sources tarifaires à revalider au moment de la sélection :**
- Twilio SMS France : https://www.twilio.com/fr-fr/sms/pricing/fr
- Vonage Messages API : https://www.vonage.fr/communications-apis/messages/pricing/
- Resend : https://resend.com/pricing
- WhatsApp Business Platform : https://business.whatsapp.com/
- Viber Business : https://www.forbusiness.viber.com/
