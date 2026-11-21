# PROCHÉLIA — cycle de vie sécurisé des missions intervenant

Statut : spécification d'implémentation candidate — ne constitue ni une fonctionnalité livrée ni une validation juridique/comptable.

## 1. Objectif métier

Permettre à un intervenant authentifié de découvrir une opportunité, candidater, accepter une affectation, réaliser une prestation, déposer des éléments de preuve, faire valider le service et suivre le montant dû puis effectivement réglé. Chaque étape doit être explicite, traçable, réversible lorsque le métier l'autorise et isolée par tenant.

Le client, la société et l'intervenant disposent de vues distinctes sur un même dossier métier canonique. Il ne faut pas créer un second moteur de mission dans l'espace intervenant.

## 2. Source de vérité et frontières

- Le dossier de mission canonique reste la source de vérité pour l'affectation et les transitions.
- L'identité provient exclusivement de la session serveur active ; le tenant provient de `resolveTenantContext`, jamais d'un en-tête ou d'un champ client.
- Les contrôles de rôle sont effectués côté API à chaque mutation.
- Le planning intervenant et les candidatures restent des ressources séparées, reliées par des identifiants canoniques.
- Le registre financier (ledger) est la source de vérité comptable. Le workspace intervenant ne fabrique aucun solde.
- Le PSP est un adaptateur externe ; l'autorisation de recevoir des fonds et l'autorisation d'émettre un virement sont deux états différents.

## 3. Machine à états proposée

Transitions attendues, toutes conditionnelles et atomiques :

1. `OPEN → APPLIED` : candidature idempotente, sous réserve d'offre ouverte, qualification et disponibilité.
2. `APPLIED → ASSIGNED` : décision explicite du client/société et contrôle d'éligibilité.
3. `ASSIGNED → READY_TO_START` : mission figée, intervenant et client confirmés, conditions et rémunération acceptées.
4. `READY_TO_START → IN_PROGRESS` : terminal enrôlé, preuve de possession, code à usage unique validé et fenêtre horaire respectée.
5. `IN_PROGRESS → SUBMITTED_FOR_REVIEW` : intervenant clôt la prestation et soumet le compte rendu et les preuves minimisées.
6. `SUBMITTED_FOR_REVIEW → APPROVED` : validation par l'acteur autorisé, hors intervenant exécutant, ou mécanisme contractuel préalablement approuvé.
7. `SUBMITTED_FOR_REVIEW → DISPUTED` : contestation motivée, pièces et horodatages conservés selon politique.
8. `APPROVED → PAYABLE` : uniquement après contrôles de contrat, fiscalité/comptabilité, commission, retenues et absence de litige bloquant.
9. `PAYABLE → PAYOUT_PENDING → PAID` : événements PSP authentifiés, idempotents et rapprochés ; `PAID` seulement après confirmation externe vérifiée.
10. Annulation et échec : états dédiés avec auteur, motif, horodatage, politique de frais et règles de notification.

Aucun client ne peut forcer directement un état terminal. Les transitions invalides, répétées ou concurrentes doivent échouer sans écriture partielle.

## 4. API à construire (proposition)

Les routes sont des propositions et doivent être alignées sur le routeur existant avant toute création :

- `POST /api/intervenant/device/enroll/challenge`
- `POST /api/intervenant/device/enroll/complete`
- `POST /api/intervenant/assignments/:id/prepare-start`
- `POST /api/intervenant/assignments/:id/start`
- `POST /api/intervenant/assignments/:id/evidence`
- `POST /api/intervenant/assignments/:id/submit`
- `POST /api/assignments/:id/approve` (rôle client/société autorisé)
- `POST /api/assignments/:id/dispute`
- `GET /api/intervenant/assignments/:id/timeline`

Ne pas créer ces routes avant d'avoir réutilisé les helpers d'authentification, de tenant, d'audit et d'idempotence déjà présents. Les actions de présence existantes restent fail-closed tant que l'enrôlement cryptographique n'est pas réellement implémenté et testé.

## 5. Exigences de sécurité

- Clé publique par appareil, challenge aléatoire à usage unique, signature de challenge et preuve de possession ; ne jamais faire confiance au User-Agent.
- Enrôlement, révocation, expiration, rotation et récupération du terminal documentés.
- Challenge et codes liés à la mission, au tenant, à l'acteur, à l'appareil et à une fenêtre de validité courte.
- Stockage des secrets sous forme de hash ; comparaison résistante aux attaques temporelles lorsque pertinente.
- Idempotency-Key obligatoire sur toute mutation rejouable ; contrainte d'unicité en base et réponse stable.
- Transactions/écritures conditionnelles pour verrouiller les transitions concurrentes.
- Journal d'audit append-only avec acteur, rôle, tenant, action, motif, horodatage et identifiant de corrélation ; pas de données personnelles inutiles.
- Vérification stricte des pièces et métadonnées, analyse antivirus, types MIME et taille ; URLs signées à durée courte, jamais de références privées dans les listes publiques.
- Limitation de débit, protection anti-énumération, révocation de session et contrôle de propriété à chaque lecture et écriture.
- Conservation, suppression et accès aux preuves selon une politique RGPD documentée.

## 6. Preuves et confidentialité

Les preuves doivent être proportionnées à la prestation : éviter la géolocalisation continue et la collecte de pièces d'identité dans les justificatifs de réalisation. Si une preuve photo, signature ou localisation est réellement nécessaire, définir sa finalité, son accès, sa durée de conservation, son information préalable et ses alternatives. Une urgence doit pouvoir être signalée sans dépendre d'une preuve numérique.

## 7. Rémunération et comptabilité

Séparer strictement :
- estimation avant acceptation ;
- montant contractuel accepté ;
- montant soumis à validation ;
- montant approuvé et payable ;
- virement en attente ;
- virement confirmé par le PSP et rapproché.

Le ledger doit être équilibré en partie double, immuable par écritures compensatoires, idempotent et référencer la mission, la facture, la commission et l'événement PSP. Ne jamais déduire `PAID` du seul statut de mission. Aucun paiement réel tant que le PSP, les webhooks, le rapprochement, les remboursements, les litiges et les contrôles de conformité ne sont pas validés.

## 8. Résilience et supervision

Chaque mutation importante produit un événement/outbox transactionnel. Les consommateurs utilisent des leases, retries bornés, dead-letter queue et clés d'idempotence. Les métriques couvrent les missions bloquées, preuves en attente, litiges, retards, erreurs PSP et files saturées. Les alertes doivent avoir un propriétaire et une procédure de reprise. Les tâches Cron configurées ne prouvent pas à elles seules qu'un Worker déployé les exécute.

## 9. Matrice de tests de sortie

- Un intervenant A ne lit ni ne modifie les missions de B.
- Un tenant A ne lit ni n'écrit les dossiers du tenant B, y compris par identifiants devinés.
- Un rôle client ne peut pas démarrer une mission au nom de l'intervenant.
- Un intervenant ne peut pas s'auto-approuver ni modifier le montant accepté.
- Deux démarrages simultanés : un seul gagne.
- Rejeu d'une même clé : réponse idempotente, aucune double écriture.
- Challenge expiré, révoqué, altéré ou signé par une autre clé : refus.
- Code déjà consommé ou mission hors fenêtre : refus.
- Preuve trop volumineuse, MIME mensonger ou URL expirée : refus.
- Panne DB, outbox, stockage ou PSP : aucun état payé fictif ; reprise vérifiable.
- Litige ouvert : versement bloqué selon règles contractuelles.
- Export, correction et suppression RGPD : contrôles d'accès et audit.
- Parcours complet Pages → Worker → D1 Preview avec comptes synthétiques isolés et nettoyage vérifié.

## 10. Conditions avant production

1. Implémentation sur branche candidate et migrations testées sur copie Preview.
2. Tests unitaires, intégration, concurrence, sécurité et E2E authentifiés verts.
3. Sauvegarde/restauration prouvée et procédure de retour arrière testée.
4. Revue sécurité indépendante et validation des obligations juridiques, sociales, fiscales et comptables par professionnels qualifiés.
5. PSP Sandbox E2E complet, rapprochement et gestion des échecs.
6. Observabilité, alertes, astreinte, objectifs SLO/RTO/RPO et procédure incident.
7. Validation humaine explicite avant toute migration distante, activation financière ou bascule Production.

## 11. État connu lors de la rédaction

- L'espace intervenant expose déjà opportunités, candidatures, affectations en lecture seule, compétences, disponibilités et profil.
- Le suivi des interventions est explicitement présenté comme indisponible.
- Les mutations de présence et de code sont fail-closed jusqu'à l'enrôlement cryptographique.
- Le workspace masque le wallet et n'affiche que des estimations lorsque le PSP n'est pas configuré.
- Les migrations candidates 0033–0036 sont nécessaires aux contrôles de disponibilité et ne sont pas réputées appliquées à la D1 Preview.
- Ce document est un plan d'implémentation, pas une preuve de livraison.

## 12. Tranche candidate — enrôlement cryptographique du terminal

Une première implémentation candidate est ajoutée dans `src/device-trust.js` :

- challenge aléatoire de 256 bits lié au tenant, à l'utilisateur, à la session et au but `ENROLL` ;
- durée de validité courte (5 minutes) et plafond de challenges en attente par session ;
- clé publique ECDSA P-256 uniquement ; toute clé privée `d` fournie par le navigateur est rejetée ;
- preuve de possession ECDSA/SHA-256 sur un message canonique qui lie le challenge, le tenant et l'utilisateur ;
- empreinte de clé calculée selon le JWK thumbprint RFC 7638 ;
- consommation conditionnelle du challenge et création du credential dans un batch D1 ; rejeu et concurrence doivent échouer ;
- liste limitée aux terminaux du compte et révocation par l'utilisateur ;
- routes candidates : `POST /api/security/device/enroll/challenge`, `POST /api/security/device/enroll/complete`, `GET /api/security/device/list`, `POST /api/security/device/revoke`.

Tests unitaires ajoutés pour le format du message, le rejet des clés privées/non P-256 et la vérification de signature. Ils doivent encore passer dans la CI de la branche candidate et être complétés par des tests d'intégration D1 couvrant challenge expiré, rejeu concurrent, révocation, changement de session et isolation tenant.

**Limite explicite :** cet enrôlement ne prouve pas à lui seul la présence au début/à la fin d'une mission. Les endpoints `/api/security/presence` et `/api/security/code/verify` restent bloqués en 503. Aucun démarrage, aucune clôture et aucun paiement ne sont activés par cette tranche. Le déploiement Preview et la migration 0039 ne sont pas exécutés ici.


### 12.1. Protection contre la réinscription d'une clé révoquée

La création du credential applique maintenant une condition SQL atomique `NOT EXISTS` sur le triplet tenant/utilisateur/empreinte de clé. Une clé déjà enregistrée, y compris révoquée, ne peut pas être réinscrite silencieusement. En cas de perte ou de révocation, l'intervenant doit générer une nouvelle paire de clés sur un terminal qu'il contrôle ; la clé privée ne quitte jamais le terminal. La contrainte UNIQUE en base reste le dernier garde-fou contre les courses concurrentes.
