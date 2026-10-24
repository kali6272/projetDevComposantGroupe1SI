const express = require('express');
const app = express();
app.use(express.json());

const products = [
  { id: 101, name: 'Maillot de Foot', price: 15000, stock: 50 },
  { id: 102, name: 'Chaussures de Crampons', price: 35000, stock: 20 }
];

// Écoute sur / et sur /products
app.get(['/', '/products'], (req, res) => {
  res.json({ status: 'success', data: products });
});

app.get(['/:id', '/products/:id'], (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
  res.json({ status: 'success', data: product });
});

app.listen(3000, () => {
  console.log('Products API (Express) démarrée sur le port 3000');
});