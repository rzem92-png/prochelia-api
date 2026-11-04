# PROCHÉLIA — SUPRA SEO Autopilot (référencement Google gratuit)

Statut : spécification d'intégration en préproduction. Ne prouve pas qu'une configuration SEO est déjà présente dans le code, ni que le domaine est vérifié/Google a indexé les pages.

## Objectif
Faire gérer par SUPRA, avec supervision et permissions, le SEO organique de PROCHÉLIA : diagnostic, priorisation, production de contenus utiles, déploiement préproduction, suivi et amélioration continue. Aucun paiement Google Ads nécessaire pour le référencement naturel. Aucun classement Google garanti.

## Domaines connus
- Cloudflare Pages : `prochelia.pages.dev`
- Cloudflare Worker : `prochelia.rzem92.workers.dev`
- Domaine personnalisé envisagé dans le contexte : `prochelia.fr`, non confirmé comme acheté/actif.
- Ne pas publier des URLs canoniques ni configurer Search Console avec un domaine personnalisé avant confirmation du domaine final, DNS, HTTPS et redirections.

## Architecture SUPRA SEO
1. **Crawler/audit** : fetch pages publiques, status HTTP, redirects, title/meta, H1/H2, canonical, robots, sitemap, links, images/alt, schema, mobile performance, broken links, duplicate content.
2. **SEO planner** : clusters de mots-clés/intention, priorisation par pertinence locale, difficulté estimée, potentiel de conversion et effort. Ne pas inventer volume/position sans données.
3. **Content studio** : pages et FAQ utiles, local pages, blog/guide, title/meta, descriptions, snippets, alt text, localized content. Éviter pages-ville quasi identiques, contenu généré en masse, claims non vérifiés, keyword stuffing.
4. **Technical optimizer** : sitemap.xml généré depuis pages publiques validées, robots.txt, canonical, hreflang pour langues réellement traduites, structured data applicable, URLs descriptives, SSR/prerender si SPA ne rend pas bien le contenu à Google.
5. **Google monitoring** : Search Console (impressions, clicks, CTR, position, indexing, sitemap, URL inspection); GA4 ou analytics privacy-preserving facultatif; Cloudflare analytics. Pas d'accès Search Console sans propriété/permissions autorisées.
6. **Local SEO** : Google Business Profile uniquement si activité et entreprise éligibles; données exactes, zone de service cohérente, pas d'adresse fictive ni profil en doublon; SUPRA prépare les changements mais utilisateur valide les opérations d'identité/ownership.
7. **Competitor & trend watch** : analyser les résultats publics et changements officiels, sans scraping abusif, bypass ou copier contenus/marques.
8. **Experimentation** : tests contrôlés titres/contenus, mesurer sur fenêtre assez longue; ne pas modifier massivement de pages simultanément.
9. **Reporting** : rapport hebdomadaire + alertes de baisse d'indexation/traffic, sitemap inaccessible, robots/noindex accidentel, 404, pages lentes, baisse CTR, contenu expiré.

## Pages publiques indexables — à prévoir
- Accueil / marque
- Comment ça marche (client/intervenant)
- Prestations et catégories réellement disponibles
- Pages de zones desservies seulement quand PROCHÉLIA y opère réellement et dispose de capacité
- Recrutement intervenants / devenir intervenant
- Sécurité, confiance, assistance, FAQ
- Informations de contact, conditions, confidentialité et mentions légales appropriées
- Guides utiles répondant aux besoins des clients/intervenants
- Pages langues localisées uniquement si traduction de qualité et contenu utile.

## Pages à protéger de l'indexation
- Login, dashboard, espace client/intervenant/admin
- API, endpoints, pages privées, documents, missions, profils privés, factures et données personnelles
- Pages internes temporaires, staging, preview
- Pages de résultats/filtres paramétriques sans valeur SEO
- Environnement préproduction: noindex + protection d'accès; vérifier les headers/meta pour éviter l'indexation.
Ne jamais exposer les données personnelles via SEO, sitemap, structured data ou pages de mission.

## Contrôles techniques requis
- Une URL canonique définitive (custom domain confirmé) avec HTTPS; redirections 301 des variantes/domaines de preview selon stratégie.
- robots.txt accessible; sitemap.xml valide, uniquement URLs canonique/public/indexable avec 200.
- Pas de `noindex` accidentel sur pages publiques; staging protégé.
- Titles/descriptions uniques, H1 et contenu textuel réellement visible.
- Internal links crawlables (`<a href>`), routes propres; Google doit pouvoir rendre le contenu important de l'application.
- Images optimisées, alt text descriptif, Core Web Vitals/mobile usability.
- Structured data uniquement vérifiable et conforme (Organization/LocalBusiness seulement si applicable, Service/FAQ selon guidelines; jamais ratings/reviews fictifs).
- Hreflang uniquement si pages linguistiques correspondantes et canonical cohérents.
- Security: aucune donnée privée, tokens, clés API ou PII dans HTML, sitemap, logs, metadata.

## Actions automatiques vs autorisation
SUPRA peut automatiquement:
- auditer, détecter erreurs, classer les corrections, rédiger propositions, générer rapport et tickets;
- publier en préproduction après tests;
- surveiller metrics et alerter.
SUPRA peut publier sur domaine public uniquement si une politique d'autorisation explicite existe pour cette catégorie de contenu et que les validations techniques/legal sont passées.
Autorisation humaine requise:
- vérifier/relier propriété Search Console, DNS/domain, Google Business Profile;
- changement domaine canonique, redirections majeures, pages de marque/légal, offres/prix/promotions;
- publication public au départ, suppression massive, modification importante de contenu/structure;
- campagnes commerciales ou claims sensibles.
Pas de manipulations: achat de liens, PBN, faux avis, fausses fiches, pages doorway, contenu copié, spam, cloaking, avis/rich snippets falsifiés, auto-generated pages sans valeur.

## Permissions et intégration API
- Search Console OAuth/API avec scopes minimum; secrets dans Cloudflare secrets/vault, jamais dans repo ou prompts.
- Comptes Google et DNS restent propriété de l'entreprise; SUPRA ne doit pas demander ni stocker mot de passe Google.
- RBAC: owner, SEO editor, analyst, read-only; journaliser les actions et snapshots.
- API quota-aware, retries/backoff, idempotence, cache; respect des conditions Google.
- Search Console API fournit des données; elle ne garantit pas une indexation ni des positions.

## KPI et objectifs de pilotage
- pages publiques indexées / pages éligibles;
- impressions, clics, CTR, position moyenne (interprétation prudente);
- trafic organique qualifié et conversion waitlist/réservation;
- visibilité marque PROCHÉLIA, requêtes et zones;
- Core Web Vitals, 404, indexation, erreurs sitemap;
- leads qualifiés, mission terminée, réachat, contribution margin;
- coûts SEO (temps/infra) et contribution nette.
Ne pas promettre première page ou résultats immédiats. Google indique que les changements peuvent prendre des semaines ou davantage et que l'indexation/classement ne sont pas garantis.

## Ordre de mise en œuvre
1. Confirmer le domaine canonique, vérifier DNS/HTTPS, protéger préproduction.
2. Auditer code et pages actuelles, corriger indexation/robots/canonical.
3. Construire sitemap et pages publiques indexables.
4. Vérifier propriétaire Search Console et soumettre sitemap (action owner).
5. Configurer reporting Search Console / Cloudflare.
6. Créer contenu de lancement local utile, unique, factuel et réellement desservi.
7. Lancer SUPRA SEO weekly audit + backlog priorisé.
8. Test staging, revue owner, déploiement public autorisé.
9. Mesurer et itérer; pas de SEO black-hat.

## Références officielles
- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Sitemap guidelines: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
