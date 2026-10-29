-- Base de l'API Fournisseurs (exécuté automatiquement au premier démarrage de suppliers-db)
CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  phone      VARCHAR(30),
  status     VARCHAR(10)  NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'inactif')),
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Les identifiants 1 et 2 reprennent les données d'origine du projet
INSERT INTO suppliers (id, name, email, phone, status) VALUES
  (1,  'Sports Shop International', 'contact@sportsshop.example',  '+226 25 30 00 01', 'actif'),
  (2,  'KBMSI SARL',                'info@kbmsi.example',          '+226 25 30 00 02', 'actif'),
  (3,  'Faso Équipements',          'ventes@fasoequip.example',    '+226 25 30 00 03', 'actif'),
  (4,  'Sahel Distribution',        'commandes@saheldist.example', '+226 25 30 00 04', 'actif'),
  (5,  'Textiles du Kadiogo',       'contact@textkadiogo.example', '+226 25 30 00 05', 'actif'),
  (6,  'Ouaga Import Export',       'oie@ouagaimport.example',     '+226 25 30 00 06', 'inactif'),
  (7,  'Bobo Sport Center',         'bsc@bobosport.example',       '+226 20 97 00 07', 'actif'),
  (8,  'West Africa Goods',         'hello@wagoods.example',       '+226 25 30 00 08', 'actif'),
  (9,  'Koudougou Matériel',        'km@koudougoumat.example',     '+226 25 44 00 09', 'inactif'),
  (10, 'Burkina Pro Sports',        'pro@bfprosports.example',     '+226 25 30 00 10', 'actif');

SELECT setval(pg_get_serial_sequence('suppliers', 'id'), (SELECT MAX(id) FROM suppliers));
