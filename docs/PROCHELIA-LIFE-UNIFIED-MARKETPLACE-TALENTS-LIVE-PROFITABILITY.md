# PROCHÉLIA LIFE — Marketplace unifiée, talents, LIVE et rentabilité partagée

Version: 1.0  
Statut: spécification produit et économique à intégrer — les fonctions décrites ne sont pas réputées implémentées dans l'API.

## 1. Décision produit

PROCHÉLIA LIFE reste une seule marque et une seule plateforme. Les univers Services, Talents & Marché local, LIVE & Créateurs et Opportunités sont des modules complémentaires d'un même écosystème, avec un compte, une identité, un portefeuille d'activité et un Copilote transversal.

La promesse commune: aider les personnes à trouver des services et des produits utiles, et aider les indépendants, artisans, producteurs et créateurs à transformer leurs compétences en activités viables.

Le LIVE n'est pas un réseau social généraliste à reconstruire. C'est une couche de découverte et de conversion qui peut s'appuyer sur les plateformes vidéo existantes et conduire vers des offres, réservations, commandes, ateliers et prestations PROCHÉLIA.

## 2. Les quatre univers dans une architecture commune

### A. PROCHÉLIA SERVICES
Demandes de services et coordination du quotidien. Chaque prestation doit avoir un statut d'éligibilité, des conditions, un prix de référence, une zone de couverture, des exigences de qualification/assurance et une disponibilité réelle.

### B. PROCHÉLIA TALENTS & MARCHÉ LOCAL
Vitrines et catalogues pour artisans, pâtissiers, cuisiniers, couturiers, créateurs, producteurs et petits commerces. Fonctions: profil professionnel, catalogue, variantes, capacité, précommande, stock, délais, retrait/livraison, commandes, acomptes, annulations, avis vérifiés et historique.

Pour les aliments: aucune ouverture de vente avant vérification des règles locales de production, hygiène, allergènes, traçabilité, conservation, livraison, étiquetage et autorisations applicables. Les obligations sont propres au pays et au type d'activité.

### C. PROCHÉLIA LIVE & CRÉATEURS
Les créateurs peuvent référencer un direct externe ou, si une fonction vidéo native est développée ultérieurement, diffuser via un prestataire technique autorisé. Le direct peut présenter des produits, proposer des réservations, vendre des ateliers, recevoir des demandes personnalisées et diriger vers une boutique PROCHÉLIA.

Fonctions: page créateur, lien de boutique partageable, offres épinglées, calendrier de lives, liens de commande traçables, codes de campagne, statistiques de conversion, divulgation des partenariats rémunérés et gestion des droits de contenu/musique.

Ne pas promettre de revenus basés sur les vues, ni simuler des cadeaux ou des gains. Les soutiens volontaires sont distincts des ventes et ne doivent pas être présentés comme des achats de produits ou des dons défiscalisables sans fondement.

### D. PROCHÉLIA OPPORTUNITÉS
Détection de besoins agrégés, partenariats locaux, débouchés commerciaux, appels à talents et expansion internationale. Les opportunités sont proposées sans garantir de missions ni imposer des horaires, prix ou refus pénalisants aux indépendants.

## 3. Une expérience cohérente pour chaque partie

### Client / acheteur
- Recherche par besoin, catégorie, lieu, date et disponibilité.
- Comparaison d'offres avec prix total, frais, délais, identité professionnelle et conditions visibles.
- Commande ou réservation, paiement via un PSP habilité, suivi, support, annulation et remboursement selon les conditions.
- Avis uniquement après transaction vérifiée.
- Historique et commandes récurrentes à l'initiative du client.

### Intervenant / artisan / créateur
- Inscription et vérification adaptées au type d'activité et au pays.
- Vitrine simple, photos, catalogue, tarifs, capacités et disponibilités maîtrisés par le professionnel.
- Vue claire du prix payé, des frais, de la commission, des taxes éventuelles, des remboursements et du montant net qui lui revient.
- Liberté de définir ses offres et d'accepter ou refuser les demandes selon son statut et les règles applicables.
- Tableau de bord des ventes, commandes, réservations, réclamations et versements.
- Export des données utiles à sa comptabilité et accès à ses justificatifs.

### PROCHÉLIA
- Revenus uniquement associés à une prestation réelle, une transaction ou un service logiciel clairement décrit.
- Outils de contrôle de fraude, qualité, sécurité, rapprochement et support.
- Suivi des marges par service, catégorie, pays, canal et cohorte.
- Aucune confusion entre argent encaissé pour compte de tiers et chiffre d'affaires propre de PROCHÉLIA.

## 4. Modèle de revenus équilibré

Sources possibles, activées progressivement et selon le cadre légal:
1. Commission de transaction clairement annoncée.
2. Frais de service/coordination uniquement lorsqu'un service distinct est réellement fourni et décrit.
3. Abonnement professionnel facultatif pour des outils avancés ayant une valeur mesurable.
4. Abonnement client/famille facultatif pour des fonctionnalités de coordination supplémentaires.
5. Campagnes et partenariats commerciaux déclarés et identifiés.
6. Ateliers, cours, événements et prestations réservés.
7. Licence SaaS ou marque blanche pour partenaires qualifiés, à maturité.

Garde-fous:
- Pas de frais cachés, double facturation ou frais de retrait surprises.
- Pas de paiement obligatoire pour obtenir une meilleure visibilité ou une promesse de missions.
- Pas de commission sur une somme qui n'appartient pas à PROCHÉLIA.
- Pas d'abonnement imposé pour accéder à des fonctions essentielles.
- Toute promotion est financée et approuvée explicitement; elle ne doit pas réduire le montant dû au professionnel sans son accord.
- Les frais PSP, taxes, remboursements et rétrofacturations sont présentés séparément.

## 5. Formule économique transactionnelle

Tous les calculs monétaires sont effectués en unités mineures entières (centimes, ou unité mineure de la devise), jamais en flottants binaires.

Pour une transaction:
- total_client = prix des articles/prestations + frais client + taxes applicables - remises financées et validées;
- montant_professionnel = montant contractuellement dû au professionnel, après les seules déductions convenues et légales;
- revenu_brut_prochelia = commissions et frais de service effectivement acquis par PROCHÉLIA;
- coûts_variables = frais PSP supportés par PROCHÉLIA + support variable + vérification variable + remboursements/pertes imputables + coûts de livraison subventionnés + coût d'acquisition attribuable + remises financées par PROCHÉLIA;
- marge_contributive = revenu_brut_prochelia - coûts_variables.

Le moteur doit conserver une photographie versionnée du devis: devise, prix de référence, quantité, frais, taxes, promotion, commission, règles applicables, arrondis, montant professionnel, version du catalogue et horodatage.

Ne jamais assimiler montant client, chiffre d'affaires, fonds de tiers, revenu professionnel, commission, marge contributive et bénéfice net.

## 6. LIVE vers commande: parcours cible

1. Le créateur partage un lien PROCHÉLIA dans sa bio ou pendant son direct.
2. Le spectateur arrive sur une page publique du créateur.
3. Il voit une offre précise, le prix total, les délais, les conditions et les limites géographiques.
4. Il passe commande ou réserve; aucune vente n'est confirmée avant validation des disponibilités et du paiement.
5. Le professionnel reçoit la commande et l'accepte selon ses capacités.
6. Le client reçoit confirmation et suivi.
7. Après exécution, le paiement est rapproché, le versement traité selon les règles PSP et l'avis vérifié peut être sollicité.
8. Les statistiques distinguent vues référées, clics, paniers, commandes payées, commandes exécutées, remboursements et marge.

Attribution: codes/liens de campagne transparents, consentement et minimisation des données. Ne pas aspirer les messages privés ou données de plateformes tierces. Utiliser uniquement des intégrations/API autorisées ou des liens fournis volontairement par le créateur.

## 7. Copilote Suprême — agents et autorisations

- Agent Offre: aide à structurer les fiches, variantes et descriptions.
- Agent Prix & Marge: simule coûts, commissions, prix et scénarios; ne publie pas seul de nouveaux prix.
- Agent Conversion: analyse les parcours et propose des tests.
- Agent Talent: aide à compléter le profil et à comprendre les démarches.
- Agent LIVE: prépare calendrier, liens, offres et rapports de campagne.
- Agent Demande locale: détecte les besoins agrégés et propose des opportunités.
- Agent Qualité & Sécurité: signale retards, litiges, risques produits et profils incomplets.
- Agent Finance: rapproche transactions, commissions, remboursements et versements.
- Agent International: prépare les dossiers pays, paiements, fiscalité, langue et partenaires.

Niveaux:
- A0 observation et analyse.
- A1 recommandations et brouillons.
- A2 opérations réversibles et plafonnées, expressément préautorisées.
- A3 approbation humaine obligatoire: prix publics, commissions, promotions, contrats, remboursements exceptionnels, versements, campagnes payantes, activation d'un pays, accès sensibles et production.
- A4 validation par professionnels compétents: avocat, expert-comptable, DPO, assureur, PSP et conseil local.

Chaque action d'agent doit être authentifiée, autorisée, journalisée, idempotente, plafonnée et révocable. Un arrêt d'urgence doit suspendre les actions automatisées sans empêcher l'accès aux informations essentielles.

## 8. Confiance, sécurité et équité

- Vérification proportionnée à l'activité, au risque, au pays et aux obligations légales.
- Pas d'avis achetés, faux compteurs, faux cadeaux ou faux revenus.
- Pas de manipulation des créateurs par des récompenses opaques ou des mécaniques assimilables à des jeux d'argent.
- Pas de classement automatique opaque pénalisant les indépendants; filtres compréhensibles et contrôle humain des décisions sensibles.
- Transparence sur les contenus sponsorisés, commissions d'affiliation et relations commerciales.
- Gestion des droits d'auteur, licences musicales, image, propriété des photos et contenus.
- Protection des mineurs et interdiction de leur faire contourner les règles de travail, de paiement ou de contenu.
- Procédure de signalement, retrait, contestation et recours.
- Données minimales, durées de conservation, consentements et droits des personnes.
- Contrôles renforcés pour les activités alimentaires, les services aux personnes vulnérables et toute activité réglementée.

## 9. Internationalisation par pays

Aucun pays n'est activé par simple traduction. Chaque dossier pays doit vérifier:
- statut de la plateforme et contrats;
- statut des vendeurs et prestataires;
- licences et autorisations par activité;
- sécurité alimentaire et produits réglementés;
- fiscalité, facturation et obligations de déclaration;
- paiements, devise, remboursements et versements;
- assurance, livraison, douanes et retours;
- données personnelles, hébergement et transferts;
- langue, accessibilité, support et résolution des litiges.

Commencer par un pilote local limité, avec des catégories non réglementées ou correctement autorisées, puis élargir à partir de transactions réellement exécutées.

## 10. Indicateurs de réussite

### Valeur client
Taux de demandes satisfaites, prix total compris avant achat, délais, taux de réclamation, taux de remboursement, satisfaction et réachat.

### Valeur professionnel
Revenu net moyen et médian, délai de versement, taux d'acceptation volontaire, commandes répétées, temps consacré à la gestion, coûts et taux de litige.

### Santé PROCHÉLIA
Marge contributive par catégorie et canal, CAC, conversion, réachat, coût de support, frais PSP, fraude, remboursements, coût IA et trésorerie.

### LIVE
Clics référés, taux de commande payée, commandes exécutées, panier moyen, part de revenus commerciaux par rapport aux soutiens volontaires et revenu net du créateur. Les vues seules ne sont pas un indicateur de réussite économique.

## 11. Plan de mise en œuvre recommandé

### Étape 0 — Audit avant codage
Réutiliser les tables, contrôles d'authentification, RBAC, journalisation, moteur de tarification, paiements et gestion des litiges existants. Éviter toute duplication. Cartographier schéma D1, routes et tests.

### Étape 1 — Fondations transactionnelles
Catalogue unifié, catégories, offres, disponibilités/capacités, devis versionnés, commande, états, idempotence, journal d'audit, rapprochement, remboursement et versement en environnement de test.

### Étape 2 — Vitrines Talents
Profils, catalogue, médias, règles de commande, précommandes, capacité, zones, avis vérifiés et tableaux de bord.

### Étape 3 — LIVE commercial
Liens de créateur, codes d'attribution, offres épinglées, réservations et rapports. Pas de streaming natif tant qu'un besoin validé ne justifie son coût.

### Étape 4 — Copilote
Agents A0/A1 d'abord; A2 limité après tests. A3/A4 restent soumis aux validations.

### Étape 5 — Pilote et extension
Pilote contrôlé, transactions de test, puis transactions réelles avec autorisations et partenaires validés. Extension géographique uniquement si qualité et marge sont démontrées.

## 12. Critères d'acceptation avant mise en service

- Un client voit le prix total et les conditions avant de s'engager.
- Le professionnel voit exactement le montant net attendu et les frais.
- Un devis ne peut pas être modifié rétroactivement après acceptation.
- Les promotions non approuvées sont rejetées.
- Une même commande ou un même paiement rejoué ne crée pas de doublon.
- Un paiement échoué ne confirme pas une commande.
- Les remboursements et reversements sont rapprochés et audités.
- Les avis ne peuvent être déposés que selon une règle de transaction vérifiée.
- Une activité non validée pour le pays ou la catégorie ne peut pas être publiée/achetée.
- Un agent ne peut pas dépasser son niveau d'autorisation, son budget ou ses quotas.
- Les actions A3/A4 sont bloquées sans approbation requise.
- Les interfaces Client, Professionnel et Gérante sont testées de bout en bout séparément.
- Les intégrations PSP, notifications, stockage média et livraison sont testées en sandbox avant tout trafic réel.

## 13. Limite de statut

Ce document formalise la cible produit et les critères d'implémentation. Il ne prouve pas que les modules Talents, LIVE, catalogue unifié, commandes ou agents sont déjà codés. Toute mise en production exige audit du code, migrations contrôlées, tests automatisés et manuels, validation juridique/comptable et approbation explicite.
