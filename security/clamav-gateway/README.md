# PROCHÉLIA — ClamAV Gateway (gratuit, auto-hébergé)

Ce service fournit l'endpoint que le Worker PROCHÉLIA attend via `DOCUMENT_SCAN_URL` et `DOCUMENT_SCAN_TOKEN`. ClamAV est un moteur antivirus libre/open source; le coût logiciel est nul. Le serveur/CPU, la supervision et la maintenance peuvent néanmoins avoir un coût. Les signatures sont gérées par le conteneur ClamAV.

## Architecture et garde-fous

- `scanner` reçoit uniquement les fichiers en binaire brut et appelle ClamAV via le réseau Docker interne.
- Le port clamd 3310 n'est jamais publié sur l'hôte.
- Le HTTP gateway écoute sur `127.0.0.1:8080` par défaut, nécessite un token secret et limite la taille à 10 Mio.
- La réponse `CLEAN` contient le SHA-256 recalculé par le scanner. Le Worker doit comparer cette empreinte à celle du fichier.
- Erreur, délai dépassé, hash incorrect, antivirus absent ou réponse invalide = document en quarantaine, jamais considéré propre.
- Le service est un point de départ préproduction; il faut le déployer sur un hôte privé toujours disponible, avec TLS entre le Worker et la passerelle, secret aléatoire, mises à jour, surveillance et tests avant production.

## Démarrage local / serveur privé

1. Installer Docker Engine + Docker Compose sur un serveur contrôlé et non exposer directement le port 3310.
2. Générer un secret fort et définir `DOCUMENT_SCAN_TOKEN` dans l'environnement du shell (ne pas le committer).
3. Depuis ce dossier, lancer `docker compose up -d --build`. Le premier démarrage peut être long pendant le téléchargement des signatures.
4. Le port HTTP est lié à localhost. Pour une intégration Worker distante, placer le gateway derrière un tunnel privé/TLS authentifié (par exemple Cloudflare Tunnel avec règle d'accès restrictive); ne pas publier l'endpoint directement sur Internet.
5. Configurer dans les secrets/env Cloudflare Worker:
   - `DOCUMENT_SCAN_URL=https://<adresse-privee-protegee>/scan`
   - `DOCUMENT_SCAN_TOKEN=<même secret>`
6. Utiliser `GET /health` pour vérifier seulement que le gateway répond. Cela ne prouve pas que ClamAV est sain; vérifier aussi `docker compose ps`, les logs et exécuter un test antivirus de préproduction autorisé.
7. Tester le fichier de test EICAR dans un environnement de test isolé, puis vérifier que l'API répond `INFECTED`, garde le fichier en quarantaine et refuse sa revue/téléchargement. Ne pas envoyer EICAR dans des parcours de production ou vers de vrais clients.

## Contrat HTTP

`POST /scan`, en-tête `Authorization: Bearer <secret>`, `Content-Type: application/octet-stream`, `X-Prochelia-SHA256: <sha256 hex>`, corps = octets du fichier. Réponse attendue:
```json
{"verdict":"CLEAN","engine":"ClamAV","signature_version":"managed-by-clamav-container","sha256":"<sha256>","scan_id":"<document-id>","threat_name":null}
```
Pour une détection, `verdict` vaut `INFECTED`; indisponibilité ou échec renvoie HTTP 503. Aucun résultat non concluant n'est traité comme propre.

## Limites

ClamAV détecte de nombreuses menaces connues mais ne garantit pas la détection de tous les malwares. Il ne remplace ni les contrôles de type/signature, ni les mises à jour, ni le contrôle d'accès, ni la sauvegarde/restauration, ni les procédures RGPD/incidents. Ce service ne devient actif dans PROCHÉLIA qu'après déploiement, configuration des secrets et tests de bout en bout.
