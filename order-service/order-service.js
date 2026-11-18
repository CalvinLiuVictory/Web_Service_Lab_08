const express = require('express');
const amqp = require('amqplib');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());

// ==========================================
// OBSERVABILITY (LAB 12)
// Membutuhkan file observability.js di folder ini
// ==========================================
require('./observability')(app, 'order-service');

// ==========================================
// SWAGGER & OPENAPI CONFIG (LAB 11)
// ==========================================
const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Order Service', version: '1.0.0', description: 'Pembuatan dan daftar pesanan' },
    servers: [{ url: 'http://localhost:3001' }],
  },
  apis: [__filename],
});

app.get('/openapi.json', (req, res) => res.json(spec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

/**
 * @openapi
 * components:
 *   schemas:
 *     OrderRequest:
 *       type: object
 *       required: [productId, qty]
 *       properties:
 *         productId: { type: integer, example: 1 }
 *         qty: { type: integer, minimum: 1, example: 2 }
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         productId: { type: integer, example: 1 }
 *         productName: { type: string, example: Keyboard Mekanik }
 *         qty: { type: integer, example: 2 }
 *         total: { type: integer, example: 900000 }
 *         createdAt: { type: string, format: date-time }
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string, example: Stok tidak cukup }
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Buat pesanan baru
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrderRequest' }
 *     responses:
 *       201: { description: Pesanan dibuat, content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
 *       400: { description: Input tidak valid }
 *       404: { description: Produk tidak ditemukan }
 *       409: { description: Stok tidak cukup }
 *       503: { description: product-service tidak tersedia }
 *   get:
 *     tags: [Orders]
 *     summary: Daftar semua pesanan
 *     responses:
 *       200: { description: Berhasil, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Order' } } } } }
 */

// ==========================================
// CONFIGURATIONS (LAB 09 & 10)
// ==========================================
const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3000';
const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost';

const orders = [];
let channel = null;

// ==========================================
// KONEKSI & PUBLISHER RABBITMQ (LAB 10)
// ==========================================
async function connectQueue() {
  try {
    const conn = await amqp.connect(AMQP_URL);
    conn.on('error', () => {});
    conn.on('close', () => { channel = null; setTimeout(connectQueue, 3000); });
    
    channel = await conn.createChannel();
    await channel.assertExchange('orders', 'fanout', { durable: true });
    console.log('✅ Terhubung ke RabbitMQ (Exchange: orders)');
  } catch (e) {
    console.error('⚠️ RabbitMQ belum tersedia, coba lagi dalam 3 detik');
    setTimeout(connectQueue, 3000);
  }
}

function publishOrderCreated(order) {
  if (!channel) return false; 
  const body = Buffer.from(JSON.stringify({ type: 'order.created', data: order }));
  return channel.publish('orders', '', body, { persistent: true, contentType: 'application/json', messageId: `order-${order.id}` });
}

// ==========================================
// ENDPOINT ROUTES (LAB 09 & 10)
// ==========================================
app.post('/orders', async (req, res) => {
  const { productId, qty } = req.body || {};
  if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ error: 'productId dan qty harus bilangan bulat > 0' });
  }

  let resp;
  try {
    // ID Diteruskan dari header request ke fetch (LAB 12)
    resp = await fetch(`${PRODUCT_URL}/products/${productId}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': req.id },
      body: JSON.stringify({ qty }),
      signal: AbortSignal.timeout(2000), 
    });
  } catch (err) {
    return res.status(503).json({ error: 'product-service tidak tersedia, coba lagi nanti' });
  }

  const data = await resp.json();
  if (!resp.ok) return res.status(resp.status).json(data); 

  const order = { id: orders.length + 1, productId, productName: data.name, qty, total: data.price * qty, createdAt: new Date().toISOString() };
  orders.push(order);
  publishOrderCreated(order);
  
  res.status(201).json(order);
});

app.get('/orders', (req, res) => res.json(orders));

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 order-service berjalan di port :${PORT}`);
  connectQueue();
});