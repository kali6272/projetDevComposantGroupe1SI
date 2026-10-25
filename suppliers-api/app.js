const express = require('express');
const { Pool } = require('pg');
const { requireRole } = require('./auth');

const app = express();
app.use(express.json());

const pool = new Pool(); // PGHOST, PGDATABASE, PGUSER, PGPASSWORD
const PORT = Number(process.env.PORT || 3000);

const READ = requireRole('user', 'admin');
const WRITE = requireRole('admin');

const STATUSES = ['actif', 'inactif'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Validation -------------------------------------------------------
function validateSupplier(body, partial = false) {
  const errors = [];
  const { name, status, email, phone } = body || {};
  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') errors.push("'name' est obligatoire (texte non vide)");
  }
  if (!partial || email !== undefined) {
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) errors.push("'email' est obligatoire et doit être une adresse valide");
  }
  if (status !== undefined && !STATUSES.includes(status)) errors.push(`'status' doit valoir : ${STATUSES.join(' ou ')}`);
  if (phone !== undefined && phone !== null && typeof phone !== 'string') errors.push("'phone' doit être un texte");
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

function handleDbError(err, res, next) {
  if (err.code === '23505') return res.status(409).json({ error: 'Un fournisseur avec cet email existe déjà' });
  next(err);
}

// --- Routes -----------------------------------------------------------
const router = express.Router();

// GET /?page=1&limit=10&name=shop&status=actif
router.get('/', READ, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const params = [];
    const filters = [];
    if (req.query.name) { params.push(`%${req.query.name}%`); filters.push(`name ILIKE $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); filters.push(`status = $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM suppliers ${where}`, params)).rows[0].n;
    params.push(limit, (page - 1) * limit);
    const { rows } = await pool.query(
      `SELECT * FROM suppliers ${where} ORDER BY id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ status: 'success', page, limit, total, data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', READ, async (req, res, next) => {
  const id = parseId(req, res); if (id === null) return;
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    res.json({ status: 'success', data: rows[0] });
  } catch (err) { next(err); }
});

router.post('/', WRITE, async (req, res, next) => {
  const errors = validateSupplier(req.body);
  if (errors.length) return res.status(400).json({ error: 'Données invalides', details: errors });
  try {
    const { name, email, status = 'actif', phone = null } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO suppliers (name, email, status, phone) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), email.toLowerCase(), status, phone]
    );
    res.status(201).json({ status: 'success', data: rows[0] });
  } catch (err) { handleDbError(err, res, next); }
});

router.put('/:id', WRITE, async (req, res, next) => {
  const id = parseId(req, res); if (id === null) return;
  const errors = validateSupplier(req.body, true);
  if (errors.length) return res.status(400).json({ error: 'Données invalides', details: errors });
  try {
    const { name, email, status, phone } = req.body;
    const { rows } = await pool.query(
      `UPDATE suppliers SET
         name = COALESCE($2, name),
         email = COALESCE($3, email),
         status = COALESCE($4, status),
         phone = COALESCE($5, phone)
       WHERE id = $1 RETURNING *`,
      [id, name?.trim() ?? null, email?.toLowerCase() ?? null, status ?? null, phone ?? null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    res.json({ status: 'success', data: rows[0] });
  } catch (err) { handleDbError(err, res, next); }
});

router.delete('/:id', WRITE, async (req, res, next) => {
  const id = parseId(req, res); if (id === null) return;
  try {
    const { rowCount } = await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    res.status(204).end();
  } catch (err) { next(err); }
});

// Kong retire le préfixe /api/v1/suppliers (strip_path) : les routes sont
// servies sur "/" ; "/suppliers" reste accepté pour un appel direct.
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/suppliers', router);
app.use('/', router);

app.use((req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Suppliers API (Express) démarrée sur le port ${PORT}`);
});
