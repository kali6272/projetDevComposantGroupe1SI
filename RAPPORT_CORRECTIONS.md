# Exercice 21 – Insuffisances relevées sur `main` et corrections apportées

Groupe 1 SI · Sécurisation de plusieurs API REST avec Kong API Gateway et Keycloak · Vérification du 24 octobre 2026

## 1. Verdict sur la branche `main`

La base était bonne : deux API Express, routage Kong, Keycloak avec realm importé, choix du plugin `jwt` en RS256 (compatible avec Kong OSS), README clair. Mais le projet ne répondait pas à tout l'exercice 21 et **Kong ne démarrait pas en l'état**.

`branchOli` est déjà fusionnée dans `main` (seuls `.gitignore` et `.gitattributes` diffèrent). La branche `KAGAMBEGA` supprime presque tous les fichiers : **à ne pas fusionner**.

## 2. Insuffisances relevées, point par point

| Point de l'exercice 21 | Constat sur `main` | Gravité |
|---|---|---|
| 1. Deux API REST indépendantes | Lecture seule (GET) : POST, PUT, DELETE renvoient 404. Données écrites en dur dans le code, pas de base de données. Pas de validation. | Moyenne |
| 2. Routage Kong | Correct : `/api/v1/products` et `/api/v1/suppliers`. | OK |
| 3. Keycloak : utilisateurs, rôles, clients | 1 seul utilisateur, 1 seul client. Le rôle `admin` existe mais n'est attribué à personne. | Moyenne |
| 4. Protection des routes | `kong.yml` contient le texte « Inserez votre clé… » à la place de la clé RSA : Kong refuse la configuration (`invalid key`) et **ne démarre pas**. | Bloquante |
| 5. Limitation par client + 401/403/429 | Un seul consumer Kong pour tous les jetons : le quota de 5 req/min est **partagé par tout le monde**, pas par client. **Aucun 403 possible** : rien ne vérifie les rôles ni les droits d'un client. | Bloquante |
| 6. Scénarios de test | Seulement des commandes curl dans le README. Pas de cas 403, pas de script ni de collection de tests. | Moyenne |

### Exigences générales du projet

| Exigence | Constat sur `main` |
|---|---|
| Installation reproductible sur une machine neuve | Non : la clé RSA est à copier à la main, et elle change à chaque recréation du conteneur Keycloak (pas de volume). |
| Scripts de création et d'initialisation des bases | Absents (pas de base). |
| Contrats d'API | Absents (pas d'OpenAPI). |
| Tests et résultats attendus | Absents en tant que fichiers. |
| Présentation PowerPoint | Absente. |
| Divers | Port d'administration Kong 8001 ouvert à tout le réseau. |

## 3. Corrections apportées (branche de correction)

Le code et les noms d'origine (Express, `ibam-realm`, `/api/v1/...`) ont été conservés.

| Problème | Correction |
|---|---|
| Clé RSA manuelle, Kong ne démarre pas | Nouveau conteneur `kong-init` : il récupère la clé publique du realm Keycloak à chaque `docker compose up` et génère `kong.yml` à partir de `kong/kong.template.yml`. Plus aucune manipulation manuelle. |
| API en lecture seule, sans base | CRUD complet (GET, POST, PUT, DELETE), pagination (`page`, `limit`), filtres (`name`, `status`), validation (400), ressource inexistante (404), email en double (409). Une base PostgreSQL par API, avec `db/init.sql` et 10 lignes de test chacune. |
| Keycloak incomplet | 3 utilisateurs : `admin1` (admin), `user1` (user), `sansrole1` (aucun rôle). 2 clients : `app-produits` et `app-fournisseurs`. |
| Pas de 403 | Deux niveaux : 1) plugin `acl` dans Kong : un client n'accède qu'à son API ; 2) contrôle des rôles dans les API (`auth.js`) : `user` = lecture, `admin` = lecture et écriture. |
| Quota partagé | Un consumer Kong par client Keycloak (`key_claim_name: azp`) ; `rate-limiting` à 10 req/min **par client** (`limit_by: consumer`). |
| Tests absents | `tests/run-tests.js` : 19 tests automatiques lancés par `docker compose --profile test run --rm tests` (accès autorisé, bout en bout, jeton absent, jeton invalide, jeton falsifié, rôle insuffisant, client non autorisé, quota dépassé et indépendance des quotas). Résultats attendus dans `tests/RESULTATS_ATTENDUS.md`. |
| Contrats d'API absents | `docs/openapi-produits.yaml` et `docs/openapi-fournisseurs.yaml` (OpenAPI 3.0, validés). |
| Divers | Port admin Kong limité à `127.0.0.1`, plugin `correlation-id`, `.env.example`, `.gitignore` complété (`node_modules`, `.env`), README réécrit. |

## 4. Où chaque code HTTP est produit

| Code | Composant | Cas |
|---|---|---|
| 401 | Kong (`jwt`) | Jeton absent, mal formé, mauvaise signature, expiré |
| 403 | Kong (`acl`) | Jeton d'un client qui n'a pas accès à cette API |
| 403 | API (`auth.js`) | Rôle insuffisant (`user1` qui écrit, `sansrole1` qui lit) |
| 429 | Kong (`rate-limiting`) | Plus de 10 requêtes par minute pour un même client |

## 5. Vérification et ce qu'il reste à faire

- **Testé :** Keycloak 22.0.1, PostgreSQL et les deux API ont tourné réellement : 19 tests sur 19 réussis. Kong n'a pas pu être téléchargé dans l'environnement de vérification. Il a été remplacé par une reproduction de la logique de ses plugins, établie d'après le code source de Kong 3.4.2.
- **À faire par le groupe :**
  - [ ] Lancer `docker compose up -d --build` puis `docker compose --profile test run --rm tests` sur un PC avec Docker Desktop, et vérifier le 19/19 avec le vrai Kong.
  - [ ] Valider les corrections (commit) et pousser la branche, puis la fusionner dans `main`.
  - [ ] Supprimer `kong/kong.yml`, qui ne sert plus (`git rm kong/kong.yml`).
  - [ ] Préparer la présentation PowerPoint et l'ajouter au dépôt.
  - [ ] Envoyer le lien du dépôt à kyfadeloumar@gmail.com avec l'objet `[PROJET_DEV_COMPOSANT_2026]` avant la présentation (29–30 octobre).
