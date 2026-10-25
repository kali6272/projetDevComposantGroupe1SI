# Résultats attendus des tests

Commande : `docker compose --profile test run --rm tests` (le script attend le début d'une minute pour que les quotas soient remis à zéro).

| ID | Scénario | Requête | Code attendu | Qui répond | Explication |
|----|----------|---------|--------------|------------|-------------|
| A1 | Accès autorisé | `GET /api/v1/products?page=1&limit=5` (admin1, app-produits) | 200 | API | Jeton valide, rôle admin, client autorisé |
| A2 | Accès autorisé | `GET /api/v1/products/101` | 200 | API | Lecture d'un produit en base |
| A3 | Bout en bout | `POST /api/v1/products` | 201 | API | Création en base PostgreSQL |
| A4 | Bout en bout | `GET /api/v1/products/{id créé}` | 200 | API | Le produit créé est relu depuis la base |
| A5 | Accès autorisé | `PUT /api/v1/products/{id}` | 200 | API | Modification réservée au rôle admin |
| A6 | Accès autorisé | `GET /api/v1/products` (user1) | 200 | API | Le rôle user peut lire |
| R1 | Rôle insuffisant | `POST /api/v1/products` (user1) | 403 | API | L'écriture exige le rôle admin |
| R2 | Rôle insuffisant | `GET /api/v1/products` (sansrole1) | 403 | API | Aucun rôle user ou admin |
| A7 | Accès autorisé | `DELETE /api/v1/products/{id}` | 204 | API | Nettoyage du produit de test |
| F1 | Accès autorisé | `GET /api/v1/suppliers?status=actif` (admin1, app-fournisseurs) | 200 | API | Filtre par statut |
| F2 | Accès autorisé | `GET /api/v1/suppliers/1` (user1) | 200 | API | Lecture autorisée |
| F3 | Rôle insuffisant | `DELETE /api/v1/suppliers/1` (user1) | 403 | API | Suppression réservée au rôle admin |
| J1 | Jeton absent | `GET /api/v1/products` sans `Authorization` | 401 | Kong (jwt) | Message `Unauthorized` |
| J2 | Jeton invalide | `Authorization: Bearer faux_token_123` | 401 | Kong (jwt) | Jeton mal formé |
| J3 | Jeton invalide | Jeton signé par une autre clé RSA | 401 | Kong (jwt) | `Invalid signature` |
| J4 | Jeton falsifié | Jeton de user1 modifié pour ajouter le rôle admin | 401 | Kong (jwt) | La signature ne correspond plus : impossible de s'attribuer un rôle |
| C1 | Client non autorisé | Jeton du client app-produits sur `/api/v1/suppliers` | 403 | Kong (acl) | `You cannot consume this service` |
| Q1 | Dépassement de quota | Requêtes répétées de app-fournisseurs | 429 | Kong (rate-limiting) | Plus de 10 requêtes par minute pour ce client |
| Q2 | Quota par client | `GET /api/v1/products/101` (app-produits) juste après | 200 | API | Le quota de app-produits est indépendant de celui de app-fournisseurs |

## Où chaque code est produit

| Code | Composant | Plugin / mécanisme |
|------|-----------|--------------------|
| 401 | Kong | `jwt` : jeton absent, mal formé, mauvaise signature ou expiré (`exp`) |
| 403 | Kong | `acl` : le client Keycloak (claim `azp`) n'a pas accès à cette API |
| 403 | API | Contrôle du rôle Keycloak (`realm_access.roles`) : `user` = lecture, `admin` = lecture + écriture |
| 429 | Kong | `rate-limiting` : 10 requêtes par minute et par client (`limit_by: consumer`) |

Ordre d'exécution dans Kong : `jwt` → `acl` → `rate-limiting` → API. Une requête rejetée en 401 ou par l'ACL n'est donc pas décomptée du quota.

## Exemple de sortie obtenue

```text
✔ [J1] jeton absent -> attendu 401, obtenu 401 (Unauthorized)
✔ [J3] jeton signé par une autre clé -> attendu 401, obtenu 401 (Invalid signature)
✔ [R1] user1 tente de créer un produit -> attendu 403, obtenu 403 (Accès refusé : rôle insuffisant)
✔ [C1] jeton du client app-produits sur l'API Fournisseurs -> attendu 403, obtenu 403 (You cannot consume this service)
   requête 8 -> 429 (restant : 0)
✔ [Q1] quota dépassé pour app-fournisseurs -> 429 (API rate limit exceeded)
Tous les tests sont réussis (19/19).
```
