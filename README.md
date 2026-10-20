Securisation de Microservices REST avec Kong Gateway et Keycloak (Exercice 21)Ce projet met en œuvre une architecture microservices conteneurisée et sécurisée. Il intègre deux API REST développées avec Node.js / Express, protégées par une passerelle Kong API Gateway (mode DB-less) et authentifiées à l'aide de jetons JWT (RS256) émis par Keycloak.🏗️ Architecture du ProjetL'infrastructure repose sur 4 conteneurs gérés et orchestrés via Docker Compose :                        +-------------------+
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
🛠️ Technologies UtiliséesAPI Gateway : Kong 3.4 (Mode Declarative / DB-less)Gestionnaire d'Identité (IdP) : Keycloak 22.0.1 (Realm auto-importé)Backend Microservices : Node.js 18 (Alpine), Express.jsOrchestration : Docker & Docker Compose📁 Structure du DépôtPlaintextProjetComposant/
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
🚀 Lancement Rapide1. PrérequisDocker Desktop installé et démarré sur la machine hôte.2. Démarrage des ConteneursÀ la racine du projet, exécutez la commande suivante pour construire les images et démarrer les services :Bashdocker compose up --build -d
3. Vérification de l'état des servicesAssurez-vous que l'ensemble des conteneurs sont à l'état Up :Bashdocker compose ps
🔒 Sécurité & Fonctionnalités ImplémentéesRoutage Dynamique :/api/v1/products $\rightarrow$ Réacheminé vers products-api:3000/api/v1/suppliers $\rightarrow$ Réacheminé vers suppliers-api:3000Authentification JWT (Keycloak) :Kong intercepte les requêtes et vérifie la signature cryptographique (RS256) du jeton d'accès via la clé publique de Keycloak.Limitation de Débit (Rate Limiting) :Limitation configurée à 5 requêtes par minute maximum par client.🧪 Scénarios de Test (Commandes cURL)Étape A : Obtention d'un Jeton d'Accès (JWT) auprès de KeycloakPowerShellcurl.exe -X POST "http://localhost:8080/realms/ibam-realm/protocol/openid-connect/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=user1" `
  -d "password=password123" `
  -d "grant_type=password" `
  -d "client_id=kong-client"
Note : Copiez la valeur contenue dans le champ "access_token" du retour JSON.Cas de Test 1 : Accès Autorisé (HTTP 200 OK)Service Produits :PowerShellcurl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/products
Service Fournisseurs :PowerShellcurl.exe -i -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" http://localhost:8000/api/v1/suppliers
Cas de Test 2 : Jeton Absent (HTTP 401 Unauthorized)PowerShellcurl.exe -i http://localhost:8000/api/v1/products
Résultat attendu : Kong rejette la requête avec 401 Unauthorized.Cas de Test 3 : Jeton Invalide (HTTP 401 Unauthorized)PowerShellcurl.exe -i -H "Authorization: Bearer faux_token_123" http://localhost:8000/api/v1/products
Résultat attendu : Kong rejette la requête pour signature/jeton invalide.Cas de Test 4 : Dépassement de Quota / Rate Limiting (HTTP 429 Too Many Requests)Exécutez la commande du Cas 1 plus de 5 fois en moins de 60 secondes.Résultat attendu : À partir de la 6ᵉ tentative, Kong bloque l'accès avec l'en-tête HTTP/1.1 429 Too Many Requests.