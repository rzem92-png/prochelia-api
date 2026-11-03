# PROCHÉLIA — antivirus ClamAV (préproduction)

ClamAV est un moteur antivirus libre/gratuit (GPLv2). Il ne tourne pas dans Cloudflare Workers : il doit être hébergé dans un service/container distinct. L'adaptateur `src/malware-scanner.js` attend un REST compatible ClamAV (`POST /v2/scan`, multipart).

## Variables Preview (secrets/env)
- `MALWARE_SCANNER_URL`: URL HTTPS privée du scanner REST, sans `/v2/scan` final.
- `MALWARE_SCANNER_TOKEN`: secret d'accès; le gateway/proxy doit valider le Bearer token. ClamAV REST lui-même ne doit pas être directement exposé à Internet.
- Ne jamais exposer le port TCP 3310 de clamd publiquement. ClamAV recommande une protection réseau stricte, son protocole TCP n'étant pas authentifié/chiffré.
- Prévoir une RAM conséquente (documentation ClamAV: typiquement 3–4 GiB), mises à jour des signatures et surveillance de leur âge.

## Flux upload requis
Authentifier + autoriser → limite taille/type → quarantaine privée → scan → libérer seulement si verdict `clean`. Tout verdict infecté, inconnu, timeout, panne ou scanner absent bloque l'accès au fichier. Limite adaptateur: 10 MiB. Ne jamais servir le fichier depuis R2/public avant le verdict.

## État / limites
Cette PR ajoute l'adaptateur et tests; aucune route d'upload publique n'a été trouvée dans `src/index.js`, donc aucune route ne peut encore appeler ce scanner. Pas de Cloudflare config, secrets, déploiement ou migration D1 effectués. ClamAV détecte les menaces connues par signatures; ne garantit pas tous les malwares/zero-days/fichiers chiffrés.
