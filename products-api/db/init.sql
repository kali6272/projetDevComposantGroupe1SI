-- Base de l'API Produits (exécuté automatiquement au premier démarrage de products-db)
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150)   NOT NULL,
  price       NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  supplier_id INTEGER,       -- identifiant d'un fournisseur de l'API Fournisseurs (base séparée)
  created_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- Les identifiants 101 et 102 reprennent les données d'origine du projet
INSERT INTO products (id, name, price, stock, supplier_id) VALUES
  (101, 'Maillot de Foot',          15000, 50, 1),
  (102, 'Chaussures de Crampons',   35000, 20, 1),
  (103, 'Ballon de match',          12000, 40, 1),
  (104, 'Protège-tibias',            5000, 60, 3),
  (105, 'Gants de gardien',         18000, 15, 3),
  (106, 'Sac de sport',             10000, 25, 4),
  (107, 'Gourde isotherme',          4000, 80, 4),
  (108, 'Short d''entraînement',     7000, 35, 5),
  (109, 'Chaussettes de foot',       2500, 100, 5),
  (110, 'Sifflet d''arbitre',        1500, 30, 2);

SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));
