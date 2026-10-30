# PROCHÉLIA — audit de pré-lancement
Date : 2026-10-30
Branche : prelaunch/v14.5.7-consolidation-audit
Base : fix/v14.5.6-security-stripe-hardening
Périmètre : dépôt API uniquement. Aucun déploiement, aucune migration D1 ni écriture Cloudflare effectués.

## Décision
**NO-GO production.** Les points P0 ci-dessous doivent être corrigés et vérifiés avant lancement.

## Faits vérifiés
- Les branches main, staging-prochelia-v14, hardening/v14.5.7-finance-pricing et fix/v14.5.6-security-stripe-hardening ont des historiques divergents.
- Versions dans src/index.js : main V14.3.0, staging V14.5.1, hardening V14.5.6, fix V14.5.7. La branche fix est 15 commits en avance et 5 en retard par rapport à hardening. Ne pas fusionner à l'aveugle.
- wrangler.jsonc de staging pointe vers prochelia-preview-db (UUID 6adb95e5-e542-4bec-9008-fbea01042305). main utilise un autre UUID D1 (04f52830-ef5a-4f17-a640-42bbc2381bba). Confirmer nom, UUID, compte et environnement avant toute commande distante.
- Le workflow de comparaison D1 est conçu en lecture seule ; son exécution n'a pas été confirmée.
- POST /api/missions reste explicitement désactivé.
- Le Copilote exige OPENAI_API_KEY ; le code inspecté décrit un contexte agrégé en lecture seule et interdit l'exécution directe des sorties du modèle. Cela ne prouve pas l'achèvement des intégrations ni des interfaces.
- Le dépôt inspecté est l'API : il ne certifie pas les espaces Client, Intervenant et Gérante.
- Le workflow critique historique utilise Node 22/setup-node v4. Un workflow de pré-lancement isolé Node 24 est ajouté sur cette branche ; son résultat doit encore être observé.
- La migration migrations/0002_server_pricing.sql contient DROP INDEX IF EXISTS malgré son commentaire « additive ». Elle n'est donc pas strictement additive ; l'effet doit être examiné et la stratégie corrigée avant application.
- Le cookie de session utilise SameSite=None. Le code contrôle les origines pour les requêtes mutantes avec Origin, mais accepte Origin absent ; X-CSRF-Token est annoncé dans CORS, sans validation effective repérée dans le fichier inspecté. Exiger une revue CSRF dédiée avant d'exposer des sessions cross-site.

## Bloquants P0

### Sécurité
1. Implémenter une défense CSRF vérifiée côté serveur : jeton signé/synchronisé, contrôle strict Origin/Referer pour les routes navigateur mutantes et politique explicite pour les appels serveur-à-serveur.
2. Tester Origin absent, null, autorisé, non autorisé, sous-domaines, cookies, CORS, sessions, révocation et fixation de session.
3. Vérifier authentification, RBAC, propriété des ressources, validation métier, idempotence et audit pour chaque route mutante.
4. Exécuter tests de sécurité et intégration avec données fictives isolées.

### Données et migrations
1. Examiner DROP INDEX dans 0002, préconditions et conséquences ; préférer une migration compatible et réversible.
2. Auditer ordre des migrations, contraintes, clés étrangères, index, préconditions et rollback.
3. Prouver sauvegarde/restauration, suppression RGPD après sauvegarde et comparaison D1 sans données personnelles.

### Paiements
1. Tester Stripe en mode test : signature, rejeu/doublons, événements hors ordre, montant/devise, paiements échoués, remboursements partiels/complets, litiges et versements.
2. Prouver cohérence atomique PSP/wallet/ledger/état métier ; geler les versements en cas d'écart.
3. Valider onboarding/KYC Connect, pays et flux de fonds avec le PSP et les conseils compétents.

### Métier, droit et interfaces
1. Faire valider contrats, assurances, statut de la plateforme, droit du travail/plateformes, prestations autorisées, consommation, fiscalité et RGPD pour le pays initial.
2. Compléter les documents avec l'identité réelle de l'exploitant et les flux réels ; les modèles du dépôt ne sont pas des validations juridiques.
3. Tester bout en bout les trois espaces et vérifier l'unicité des règles tarifaires API.
4. Vérifier stockage, antivirus, notifications, signature, support, litiges et preuves de livraison.

## P1 — international et acquisition
- Construire Country Packs : pays/région, langues, devises, fuseaux, fiscalité, paiements, prestations permises, autorisations, assurances et règles sociales. Aucun pays activé par défaut.
- Les campagnes SEO/CRM/publicité/réseaux sociaux nécessitent connecteurs autorisés, bases légales, consentement lorsque requis, plafonds budgétaires et validation.
- Mesurer conversion et marge réelles avant d'augmenter les dépenses.

## Critères de sortie
CI verte et reproductible ; aucun P0 ouvert ; tests API/D1/Stripe/frontend réussis ; restauration vérifiée ; validations juridique, assurance, comptable et PSP obtenues ; feu vert humain documenté avant production.

## Limites
Inspection statique GitHub uniquement : ce document n'est ni un pentest, ni un audit juridique, ni une preuve d'exécution des tests, ni une validation Cloudflare/Stripe, ni une autorisation de production.
