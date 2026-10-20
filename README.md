
je veux que tu tranforme ça ne fichier markdown # Sécurisation de Microservices REST avec Kong Gateway et Keycloak (Exercice 21)

Ce projet met en œuvre une architecture microservices conteneurisée et sécurisée. Il intègre deux API REST développées avec **Node.js / Express**, protégées par une passerelle **Kong API Gateway** (mode DB-less) et authentifiées à l'aide de jetons **JWT (RS256)** émis par **Keycloak**.

---

## 🏗️ Architecture du Projet

L'infrastructure repose sur 4 conteneurs gérés et orchestrés via Docker Compose :

```text
+-------------------+
| Client (cURL) |
+---------+---------+
|
v
+-------------------+
| Kong Gateway |
| (Port 8000) |
+----+---------+----+
| |
+--------------+ +--------------+
| (Validation JWT / RS256) |
v v
+-------------------+ +-------------------+
| Products API | | Suppliers API |
| (Port 3000) | | (Port 3000) |
+-------------------+ +-------------------+
^ ^
| |
+-----------------+---------------------+
|
+---------+---------+
| Keycloak |
| (Port 8080) |
+-------------------+

🛠️ Technologies Utilisées
Rôle	Technologie
API Gateway	Kong 3.4 (mode déclaratif / DB-less)
Gestionnaire d'identité (IdP)	Keycloak 22.0.1 (Realm auto-importé)
Backend microservices	Node.js 18 (Alpine), Express.js
Orchestration	Docker & Docker Compose
📁 Structure du Dépôt
Plaintext

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
🚀 Lancement Rapide
1. Prérequis
Docker Desktop installé et démarré sur la machine hôte.

2. Démarrage initial des conteneurs
À la racine du projet, exécutez la commande suivante pour construire les images et démarrer les services :

Bash

docker compose up --build -d
3. Configuration de la Clé RSA (Important pour les collaborateurs)
Si vous clonez ce projet sur une nouvelle machine, Keycloak générera une nouvelle paire de clés RSA. Vous devez récupérer votre propre clé publique et l'insérer dans le fichier kong/kong.yml :

Ouvrez votre navigateur et accédez à : http://localhost:8080/realms/ibam-realm (ou récupérez la clé depuis la console d'administration dans Realm Settings > Keys).
Modifiez le fichier kong/kong.yml pour y insérer votre clé :
YAML

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
      Insérez votre clé rsa récupérée depuis Keycloak ici
      -----END PUBLIC KEY-----
Redémarrez le conteneur Kong pour appliquer la nouvelle clé :

Bash

docker compose restart kong
4. Vérification de l'état des services
Assurez-vous que l'ensemble des conteneurs sont à l'état Up :

Bash

docker compose ps
🔒 Sécurité & Fonctionnalités Implémentées
Routage dynamique
/api/v1/products → réacheminé vers products-api:3000
/api/v1/suppliers → réacheminé vers suppliers-api:3000
Authentification JWT (Keycloak) : Kong intercepte les requêtes et vérifie la signature cryptographique (RS256) du jeton d'accès via la clé publique de Keycloak.
Limitation de débit (Rate Limiting) : limitation configurée à 5 requêtes par minute maximum par client.
🧪 Scénarios de Test (Commandes cURL)
Étape A : Obtention d'un jeton d'accès (JWT) auprès de Keycloak
PowerShell

curl.exe -X POST "http://localhost:8080/realms/ibam-realm/protocol/openid-connect/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=user1" `
  -d "password=password123" `
  -d "grant_type=password" `
  -d "client_id=kong-client"
Note : copiez la valeur contenue dans le champ "access_token" du retour JSON.

Cas de test 1 : Accès autorisé (HTTP 200 OK)
Service Produits :

PowerShell

curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/products
Service Fournisseurs :

PowerShell

curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/suppliers
Cas de test 2 : Jeton absent (HTTP 401 Unauthorized)
PowerShell

curl.exe -i http://localhost:8000/api/v1/products
Résultat attendu : Kong rejette la requête avec 401 Unauthorized.

Cas de test 3 : Jeton invalide (HTTP 401 Unauthorized)
PowerShell

curl.exe -i -H "Authorization: Bearer faux_token_123" http://localhost:8000/api/v1/products
Résultat attendu : Kong rejette la requête pour signature/jeton invalide.

Cas de test 4 : Dépassement de quota / Rate Limiting (HTTP 429 Too Many Requests)
Exécutez la commande du cas de test 1 plus de 5 fois en moins de 60 secondes.

Résultat attendu : à partir de la 6ᵉ tentative, Kong bloque l'accès avec l'en-tête HTTP/1.1 429 Too Many Requests.


J’ai transformé ton document en fichier Markdown (.md), en conservant la structure, les commandes, les configurations YAML et les scénarios de test.

📄 

Tu peux l’ouvrir avec Visual Studio Code, le modifier ou le déposer directement dans ton dépôt Git comme fichier README.md. 



Bibliothèque
/
securisation-microservices-kong-keycloak.md



Sécurisation de microservices REST avec Kong Gateway et Keycloak (Exercice 21)
Ce projet met en œuvre une architecture de microservices conteneurisée et sécurisée. Il intègre deux API REST développées avec Node.js / Express, protégées par une passerelle Kong API Gateway en mode DB-less et authentifiées à l’aide de jetons JWT (RS256) émis par Keycloak.

🏗️ Architecture du projet
L’infrastructure repose sur quatre conteneurs gérés et orchestrés via Docker Compose :

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
🛠️ Technologies utilisées
Rôle	Technologie
API Gateway	Kong 3.4 (mode déclaratif / DB-less)
Gestionnaire d’identité (IdP)	Keycloak 22.0.1 (Realm auto-importé)
Backend des microservices	Node.js 18 (Alpine), Express.js
Orchestration	Docker et Docker Compose
📁 Structure du dépôt
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
🚀 Lancement rapide
1. Prérequis
Docker Desktop doit être installé et démarré sur la machine hôte.

2. Démarrage initial des conteneurs
À la racine du projet, exécutez la commande suivante pour construire les images et démarrer les services :

docker compose up --build -d
3. Configuration de la clé RSA (important pour les collaborateurs)
Si vous clonez ce projet sur une nouvelle machine, vérifiez que la clé publique configurée dans Kong correspond à celle utilisée par Keycloak. Si Keycloak génère une nouvelle paire de clés RSA, vous devez récupérer la clé publique et l’insérer dans le fichier kong/kong.yml.

Ouvrez votre navigateur et accédez à http://localhost:8080/realms/ibam-realm, ou récupérez la clé depuis la console d’administration dans Realm Settings > Keys.

Modifiez le fichier kong/kong.yml pour y insérer votre clé publique :

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
Redémarrez le conteneur Kong pour appliquer la configuration :

docker compose restart kong
4. Vérification de l’état des services
Assurez-vous que l’ensemble des conteneurs sont à l’état Up :

docker compose ps
🔒 Sécurité et fonctionnalités implémentées
Routage des requêtes

/api/v1/products est réacheminé vers products-api:3000.

/api/v1/suppliers est réacheminé vers suppliers-api:3000.

Authentification JWT avec Keycloak : Kong intercepte les requêtes et vérifie la signature cryptographique RS256 du jeton d’accès à l’aide de la clé publique de Keycloak.

Limitation du débit (Rate Limiting) : la configuration limite le nombre de requêtes à 5 par minute selon la politique locale.

🧪 Scénarios de test avec cURL
Étape A : obtenir un jeton d’accès (JWT) auprès de Keycloak
Dans PowerShell, exécutez :

curl.exe -X POST "http://localhost:8080/realms/ibam-realm/protocol/openid-connect/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=user1" `
  -d "password=password123" `
  -d "grant_type=password" `
  -d "client_id=kong-client"
Remarque : copiez la valeur du champ access_token dans la réponse JSON.

Cas de test 1 : accès autorisé (HTTP 200 OK)
Service Produits :

curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/products
Service Fournisseurs :

curl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/suppliers
Cas de test 2 : jeton absent (HTTP 401 Unauthorized)
curl.exe -i http://localhost:8000/api/v1/products
Résultat attendu : Kong rejette la requête avec le statut 401 Unauthorized.

Cas de test 3 : jeton invalide (HTTP 401 Unauthorized)
curl.exe -i -H "Authorization: Bearer faux_token_123" http://localhost:8000/api/v1/products
Résultat attendu : Kong rejette la requête parce que le jeton est invalide ou que sa signature ne peut pas être vérifiée.

Cas de test 4 : dépassement du quota — Rate Limiting (HTTP 429 Too Many Requests)
Exécutez la commande du cas de test 1 plus de cinq fois en moins de 60 secondes.

Résultat attendu : si la limite est atteinte, Kong bloque les requêtes suivantes avec le statut 429 Too Many Requests.

Remarque : le comportement exact dépend de la configuration du plugin et de la façon dont le client est identifié. Vérifiez également que le jeton émis par Keycloak et la clé publique configurée dans Kong correspondent bien.

