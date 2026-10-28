const express = require('express');
const app = express();
app.use(express.json());

const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3000';
const orders = [];

app.post('/orders', async (req, res) => {
  const { productId, qty } = req.body || {};
  if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1)
    return res.status(400).json({ error: 'productId dan qty harus bilangan bulat > 0' });

  let resp;
  try {
    // Komunikasi HTTP Synchronous ke product-service
    resp = await fetch(`${PRODUCT_URL}/products/${productId}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
      signal: AbortSignal.timeout(2000), // Timeout 2 detik
    });
  } catch (err) {
    return res.status(503).json({ error: 'product-service tidak tersedia, coba lagi nanti' });
  }

  const data = await resp.json();
  if (!resp.ok) return res.status(resp.status).json(data); // Teruskan error 404 / 409

  const order = { 
    id: orders.length + 1, 
    productId, 
    productName: data.name,
    qty, 
    total: data.price * qty, 
    createdAt: new Date().toISOString() 
  };
  orders.push(order);
  res.status(201).json(order);
});

app.get('/orders', (req, res) => res.json(orders));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 order-service di :${PORT}`));