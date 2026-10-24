# Sécurisation de microservices REST avec Kong Gateway et Keycloak

> **Exercice 21** : architecture de microservices conteneurisée, protégée par une passerelle API et authentifiée par des jetons JWT.

## Sommaire

1. [Présentation](#1-présentation)
2. [Architecture](#2-architecture)
3. [Technologies utilisées](#3-technologies-utilisées)
4. [Structure du dépôt](#4-structure-du-dépôt)
5. [Lancement rapide](#5-lancement-rapide)
6. [Configuration de la clé RSA](#6-configuration-de-la-clé-rsa)
7. [Sécurité et fonctionnalités](#7-sécurité-et-fonctionnalités)
8. [Scénarios de test](#8-scénarios-de-test)
9. [Dépannage](#9-dépannage)

---

## 1. Présentation

Ce projet met en œuvre une architecture de microservices conteneurisée et sécurisée :

- deux **API REST** développées avec **Node.js / Express** ;
- une passerelle **Kong API Gateway** en mode DB-less, point d'entrée unique ;
- des jetons **JWT (RS256)** émis par **Keycloak** et validés par Kong.

---

## 2. Architecture

L'infrastructure repose sur **4 conteneurs** orchestrés via Docker Compose.

```text
                        +-------------------+
                        |   Client (cURL)   |
                        +---------+---------+
                                  |
                                  v
                        +-------------------+
                        |   Kong Gateway    |
                        |   (Port 8000)     |
                        +----+---------+----+
                             |         |
              +--------------+         +--------------+
              | (Validation JWT / RS256)              |
              v                                       v
    +-------------------+                   +-------------------+
    |   Products API    |                   |   Suppliers API   |
    |   (Port 3000)     |                   |   (Port 3000)     |
    +-------------------+                   +-------------------+
              ^                                       ^
              |                                       |
              +-----------------+---------------------+
                                |
                      +---------+---------+
                      |     Keycloak      |
                      |   (Port 8080)     |
                      +-------------------+
```

| Conteneur | Rôle | Port |
|-----------|------|------|
| `kong` | Passerelle API (routage, validation JWT, rate limiting) | 8000 |
| `keycloak` | Fournisseur d'identité (émission des jetons) | 8080 |
| `products-api` | Service REST Produits | 3000 |
| `suppliers-api` | Service REST Fournisseurs | 3000 |

---

## 3. Technologies utilisées

| Rôle | Technologie |
|------|-------------|
| API Gateway | Kong 3.4 (mode déclaratif / DB-less) |
| Gestionnaire d'identité (IdP) | Keycloak 22.0.1 (Realm auto-importé) |
| Backend des microservices | Node.js 18 (Alpine), Express.js |
| Orchestration | Docker et Docker Compose |

---

## 4. Structure du dépôt

```text
ProjetDevComposant/
├── docker-compose.yml          # Orchestration des 4 services
├── README.md                   # Documentation du projet
├── keycloak/
│   └── realm-export.json       # Export du Realm « ibam-realm »
├── kong/
│   └── kong.yml                # Configuration déclarative (routes, plugins, JWT, consumer)
├── products-api/
│   ├── app.js                  # Service REST Produits
│   ├── package.json
│   └── Dockerfile
└── suppliers-api/
    ├── app.js                  # Service REST Fournisseurs
    ├── package.json
    └── Dockerfile
```

---

## 5. Lancement rapide

### Prérequis

- **Docker Desktop** installé et démarré sur la machine hôte.

### Étape 1 : démarrer les conteneurs

À la racine du projet, construire les images et démarrer les services :

```bash
docker compose up --build -d
```

### Étape 2 : vérifier l'état des services

Tous les conteneurs doivent être à l'état `Up` :

```bash
docker compose ps
```

### Étape 3 : configurer la clé RSA

Voir la section suivante. Cette étape est **indispensable** sur une nouvelle machine.

---

## 6. Configuration de la clé RSA

> ⚠️ **Important pour les collaborateurs.**
> Si vous clonez ce projet sur une nouvelle machine, Keycloak peut générer une nouvelle paire de clés RSA. La clé publique configurée dans Kong doit correspondre à celle utilisée par Keycloak, sinon tous les jetons seront rejetés.

### 6.1 Récupérer la clé publique

Deux possibilités :

- ouvrir `http://localhost:8080/realms/ibam-realm` dans le navigateur ;
- ou passer par la console d'administration : **Realm Settings > Keys**.

### 6.2 Insérer la clé dans `kong/kong.yml`

Remplacer le bloc `rsa_public_key` par votre clé publique :

```yaml
_format_version: "3.0"

services:
  - name: suppliers-service
    url: http://suppliers-api:3000
    routes:
      - name: suppliers-route
        paths:
          - /api/v1/suppliers
        strip_path: true

  - name: products-service
    url: http://products-api:3000
    routes:
      - name: products-route
        paths:
          - /api/v1/products
        strip_path: true

plugins:
  - name: jwt
    config:
      claims_to_verify:
        - exp
      key_claim_name: iss

  - name: rate-limiting
    config:
      minute: 5
      policy: local
      fault_tolerant: true

consumers:
  - username: keycloak-issuer

jwt_secrets:
  - consumer: keycloak-issuer
    key: "http://localhost:8080/realms/ibam-realm"
    algorithm: RS256
    rsa_public_key: |
      -----BEGIN PUBLIC KEY-----
      Insérez votre clé RSA récupérée depuis Keycloak ici
      -----END PUBLIC KEY-----
```

### 6.3 Redémarrer Kong

```bash
docker compose restart kong
```

---

## 7. Sécurité et fonctionnalités

### Routage

| Route exposée par Kong | Service cible |
|------------------------|---------------|
| `/api/v1/products` | `products-api:3000` |
| `/api/v1/suppliers` | `suppliers-api:3000` |

### Authentification JWT (Keycloak)

Kong intercepte chaque requête et vérifie la **signature cryptographique RS256** du jeton d'accès à l'aide de la clé publique de Keycloak. La date d'expiration (`exp`) est également contrôlée.

### Limitation de débit (Rate Limiting)

- **5 requêtes par minute** au maximum ;
- politique `local` ;
- mode `fault_tolerant` activé.

---

## 8. Scénarios de test

Les commandes sont écrites pour **PowerShell** (`curl.exe`).

### Résumé

| Cas | Scénario | Résultat attendu |
|-----|----------|------------------|
| 1 | Jeton valide | `200 OK` |
| 2 | Jeton absent | `401 Unauthorized` |
| 3 | Jeton invalide | `401 Unauthorized` |
| 4 | Plus de 5 requêtes en 60 s | `429 Too Many Requests` |

### Étape A : obtenir un jeton d'accès

```powershell
curl.exe -X POST "http://localhost:8080/realms/ibam-realm/protocol/openid-connect/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=user1" `
  -d "password=password123" `
  -d "grant_type=password" `
  -d "client_id=kong-client"
```

> **Remarque :** copiez la valeur du champ `access_token` de la réponse JSON, puis remplacez `VOTRE_ACCESS_TOKEN` dans les commandes ci-dessous.

### Cas 1 : accès autorisé (HTTP 200 OK)

**Service Produits**

```powershell
curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/products
```

**Service Fournisseurs**

```powershell
curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/suppliers
```

### Cas 2 : jeton absent (HTTP 401 Unauthorized)

```powershell
curl.exe -i http://localhost:8000/api/v1/products
```

**Résultat attendu :** Kong rejette la requête avec le statut `401 Unauthorized`.

### Cas 3 : jeton invalide (HTTP 401 Unauthorized)

```powershell
curl.exe -i -H "Authorization: Bearer faux_token_123" http://localhost:8000/api/v1/products
```

**Résultat attendu :** Kong rejette la requête, car le jeton est invalide ou sa signature ne peut pas être vérifiée.

### Cas 4 : dépassement du quota (HTTP 429 Too Many Requests)

Exécuter la commande du cas 1 **plus de 5 fois en moins de 60 secondes**.

**Résultat attendu :** une fois la limite atteinte, Kong bloque les requêtes suivantes avec le statut `429 Too Many Requests`.

> **Remarque :** le comportement exact dépend de la configuration du plugin et de la façon dont le client est identifié.

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| `401` alors que le jeton est valide | Clé publique de Kong différente de celle de Keycloak | Reprendre la [section 6](#6-configuration-de-la-clé-rsa), puis `docker compose restart kong` |
| Impossible d'obtenir un jeton | Keycloak pas encore démarré | Attendre, puis vérifier avec `docker compose ps` |
| `429` trop tôt | Limite de 5 requêtes par minute atteinte | Patienter 60 secondes |