const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());

// ==========================================
// OBSERVABILITY & HEALTH CHECK (LAB 12)
// Membutuhkan file observability.js di folder ini
// ==========================================
require('./observability')(app, 'product-service');

// ==========================================
// SWAGGER / OPENAPI (LAB 11)
// ==========================================
const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Product Service', version: '1.0.0', description: 'Data produk dan stok' },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: [__filename],
});
app.get('/openapi.json', (req, res) => res.json(spec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

const products = [
  { id: 1, name: 'Keyboard Mekanik', price: 450000, stock: 10, category: 'Periferal' },
  { id: 2, name: 'Mouse Wireless', price: 150000, stock: 5, category: 'Periferal' },
  { id: 3, name: 'Monitor 24 Inch', price: 2000000, stock: 2, category: 'Periferal' }
];

/**
 * @openapi
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         name: { type: string, example: Keyboard Mekanik }
 *         price: { type: integer, example: 450000 }
 *         stock: { type: integer, example: 10 }
 *         category: { type: string, example: Periferal } 
 *     ReserveRequest:
 *       type: object
 *       required: [qty]
 *       properties:
 *         qty: { type: integer, minimum: 1, example: 2 }
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string, example: Produk tidak ditemukan }
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Daftar semua produk
 *     responses:
 *       200: { description: Berhasil, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Product' } } } } }
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Detail satu produk
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Berhasil, content: { application/json: { schema: { $ref: '#/components/schemas/Product' } } } }
 *       404: { description: Produk tidak ditemukan }
 * /products/{id}/reserve:
 *   post:
 *     tags: [Products]
 *     summary: Kurangi stok produk (dipanggil service lain)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReserveRequest' }
 *     responses:
 *       200: { description: Stok berhasil dikurangi, content: { application/json: { schema: { $ref: '#/components/schemas/Product' } } } }
 *       400: { description: qty tidak valid }
 *       404: { description: Produk tidak ditemukan }
 *       409: { description: Stok tidak cukup }
 */

// ==========================================
// ENDPOINT ROUTES (LAB 09 & 10)
// ==========================================
app.get('/products', (req, res) => res.json(products));

app.get('/products/:id', (req, res) => {
  const p = products.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(p);
});

app.post('/products/:id/reserve', (req, res) => {
  const p = products.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  
  const { qty } = req.body;
  if (!qty || qty < 1) return res.status(400).json({ error: 'qty tidak valid' });
  if (p.stock < qty) return res.status(409).json({ error: 'Stok tidak cukup' }); // Dikembalikan ke 409
  
  p.stock -= qty;
  res.json(p);
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 product-service berjalan di port :${PORT}`));