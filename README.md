# Sécurisation de Microservices REST avec Kong Gateway et Keycloak (Exercice 21)

Ce projet met en œuvre une architecture microservices conteneurisée et sécurisée. Il intègre deux API REST développées avec **Node.js / Express**, protégées par une passerelle **Kong API Gateway** (mode DB-less) et authentifiées à l'aide de jetons **JWT (RS256)** émis par **Keycloak**.

## 🏗️ Architecture du Projet

L'infrastructure repose sur 4 conteneurs gérés et orchestrés via Docker Compose :

```text
                        +-------------------+
                        |   Client (cURL)   |
                        +---------+---------+
                                  |
                                  v
                        +-------------------+
                        |  Kong Gateway     |
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

## 🛠️ Technologies Utilisées

| Rôle | Technologie |
|------|-------------|
| API Gateway | Kong 3.4 (mode déclaratif / DB-less) |
| Gestionnaire d'identité (IdP) | Keycloak 22.0.1 (Realm auto-importé) |
| Backend microservices | Node.js 18 (Alpine), Express.js |
| Orchestration | Docker & Docker Compose |

## 📁 Structure du Dépôt

```text
ProjetDevComposant/
├── docker-compose.yml          # Orchestration des 4 services
├── README.md                   # Documentation du projet
├── keycloak/
│   └── realm-export.json       # Export du Realm 'ibam-realm'
├── kong/
│   └── kong.yml                # Configuration déclarative (Routes, Plugins, JWT, Consumer)
├── products-api/
│   ├── app.js                  # Service REST Produits
│   ├── package.json
│   └── Dockerfile
└── suppliers-api/
    ├── app.js                  # Service REST Fournisseurs
    ├── package.json
    └── Dockerfile
```

## 🚀 Lancement Rapide

### 1. Prérequis

Docker Desktop installé et démarré sur la machine hôte.

### 2. Démarrage des conteneurs

À la racine du projet, exécutez la commande suivante pour construire les images et démarrer les services :

```bash
docker compose up --build -d
```

### 3. Vérification de l'état des services

Assurez-vous que l'ensemble des conteneurs sont à l'état `Up` :

```bash
docker compose ps
```

## 🔒 Sécurité & Fonctionnalités Implémentées

- **Routage dynamique**
  - `/api/v1/products` → réacheminé vers `products-api:3000`
  - `/api/v1/suppliers` → réacheminé vers `suppliers-api:3000`
- **Authentification JWT (Keycloak)** : Kong intercepte les requêtes et vérifie la signature cryptographique (RS256) du jeton d'accès via la clé publique de Keycloak.
- **Limitation de débit (Rate Limiting)** : limitation configurée à **5 requêtes par minute** maximum par client.

## 🧪 Scénarios de Test (Commandes cURL)

### Étape A : Obtention d'un jeton d'accès (JWT) auprès de Keycloak

```powershell
curl.exe -X POST "http://localhost:8080/realms/ibam-realm/protocol/openid-connect/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=user1" `
  -d "password=password123" `
  -d "grant_type=password" `
  -d "client_id=kong-client"
```

> **Note :** copiez la valeur contenue dans le champ `"access_token"` du retour JSON.

### Cas de test 1 : Accès autorisé (HTTP 200 OK)

**Service Produits :**

```powershell
curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/products
```

**Service Fournisseurs :**

```powershell
curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/suppliers
```

### Cas de test 2 : Jeton absent (HTTP 401 Unauthorized)

```powershell
curl.exe -i http://localhost:8000/api/v1/products
```

**Résultat attendu :** Kong rejette la requête avec `401 Unauthorized`.

### Cas de test 3 : Jeton invalide (HTTP 401 Unauthorized)

```powershell
curl.exe -i -H "Authorization: Bearer faux_token_123" http://localhost:8000/api/v1/products
```

**Résultat attendu :** Kong rejette la requête pour signature/jeton invalide.

### Cas de test 4 : Dépassement de quota / Rate Limiting (HTTP 429 Too Many Requests)

Exécutez la commande du cas de test 1 plus de 5 fois en moins de 60 secondes.

**Résultat attendu :** à partir de la 6ᵉ tentative, Kong bloque l'accès avec l'en-tête `HTTP/1.1 429 Too Many Requests`.