const express = require('express');
const app = express();
app.use(express.json());

const suppliers = [
  { id: 1, name: 'Sports Shop International', status: 'actif' },
  { id: 2, name: 'KBMSI SARL', status: 'actif' }
];

// Écoute sur / et sur /suppliers
app.get(['/', '/suppliers'], (req, res) => {
  res.json({ status: 'success', data: suppliers });
});

app.get(['/:id', '/suppliers/:id'], (req, res) => {
  const supplier = suppliers.find(s => s.id === parseInt(req.params.id));
  if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' });
  res.json({ status: 'success', data: supplier });
});

app.listen(3000, () => {
  console.log('Suppliers API (Express) démarrée sur le port 3000');
});