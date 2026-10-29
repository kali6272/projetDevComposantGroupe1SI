const express = require('express');
const { Pool, types } = require('pg');
const { requireRole } = require('./auth');

// Renvoyer les colonnes NUMERIC (prix) comme des nombres et non des chaînes
types.setTypeParser(1700, parseFloat);

const app = express();
app.use(express.json());

const pool = new Pool(); // PGHOST, PGDATABASE, PGUSER, PGPASSWORD
const PORT = Number(process.env.PORT || 3000);

const READ = requireRole('user', 'admin');
const WRITE = requireRole('admin');

// --- Validation -------------------------------------------------------
function validateProduct(body, partial = false) {
  const errors = [];
  const { name, price, stock, supplier_id } = body || {};
  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') errors.push("'name' est obligatoire (texte non vide)");
  }
  if (!partial || price !== undefined) {
    if (typeof price !== 'number' || !(price > 0)) errors.push("'price' est obligatoire et doit être un nombre > 0");
  }
  if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) errors.push("'stock' doit être un entier >= 0");
  if (supplier_id !== undefined && supplier_id !== null && !Number.isInteger(supplier_id)) errors.push("'supplier_id' doit être un entier");
  return errors;
}

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return null;
  }
  return id;
}

// --- Routes -----------------------------------------------------------
const router = express.Router();

// GET /?page=1&limit=10&name=maillot
router.get('/', READ, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const params = [];
    let where = '';
    if (req.query.name) {
      params.push(`%${req.query.name}%`);
      where = `WHERE name ILIKE $${params.length}`;
    }
    const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM products ${where}`, params)).rows[0].n;
    params.push(limit, (page - 1) * limit);
    const { rows } = await pool.query(
      `SELECT * FROM products ${where} ORDER BY id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ status: 'success', page, limit, total, data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', READ, async (req, res, next) => {
  const id = parseId(req, res); if (id === null) return;
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json({ status: 'success', data: rows[0] });
  } catch (err) { next(err); }
});

router.post('/', WRITE, async (req, res, next) => {
  const errors = validateProduct(req.body);
  if (errors.length) return res.status(400).json({ error: 'Données invalides', details: errors });
  try {
    const { name, price, stock = 0, supplier_id = null } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO products (name, price, stock, supplier_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), price, stock, supplier_id]
    );
    res.status(201).json({ status: 'success', data: rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id', WRITE, async (req, res, next) => {
  const id = parseId(req, res); if (id === null) return;
  const errors = validateProduct(req.body, true);
  if (errors.length) return res.status(400).json({ error: 'Données invalides', details: errors });
  try {
    const { name, price, stock, supplier_id } = req.body;
    const { rows } = await pool.query(
      `UPDATE products SET
         name = COALESCE($2, name),
         price = COALESCE($3, price),
         stock = COALESCE($4, stock),
         supplier_id = COALESCE($5, supplier_id)
       WHERE id = $1 RETURNING *`,
      [id, name?.trim() ?? null, price ?? null, stock ?? null, supplier_id ?? null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json({ status: 'success', data: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', WRITE, async (req, res, next) => {
  const id = parseId(req, res); if (id === null) return;
  try {
    const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Produit non trouvé' });
    res.status(204).end();
  } catch (err) { next(err); }
});

// Kong retire le préfixe /api/v1/products (strip_path) : les routes sont
// servies sur "/" ; "/products" reste accepté pour un appel direct.
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/products', router);
app.use('/', router);

app.use((req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Products API (Express) démarrée sur le port ${PORT}`);
});
