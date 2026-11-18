const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const swaggerUi = require('swagger-ui-express');
const crypto = require('crypto');

const app = express();

// ==========================================
// OBSERVABILITY & HEALTH CHECK (LAB 12)
// Harus diletakkan sebelum middleware proxy
// ==========================================
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.headers['x-request-id']);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

// ==========================================
// DOKUMENTASI API / SWAGGER (LAB 11)
// ==========================================
const DOC_SOURCES = [
  { prefix: '/product-service', url: process.env.PRODUCT_DOC_URL || 'http://localhost:3000/openapi.json' },
  { prefix: '/order-service',   url: process.env.ORDER_DOC_URL   || 'http://localhost:3001/openapi.json' },
];

async function buildSpec() {
  const merged = {
    openapi: '3.0.3',
    info: { title: 'Toko API (via Gateway)', version: '1.0.0' },
    servers: [{ url: '/' }], 
    paths: {},
    components: { schemas: {} },
  };

  for (const s of DOC_SOURCES) {
    try {
      const spec = await fetch(s.url, { signal: AbortSignal.timeout(2000) }).then(r => r.json());
      for (const [path, ops] of Object.entries(spec.paths || {})) {
        merged.paths[s.prefix + path] = ops;
      }
      Object.assign(merged.components.schemas, (spec.components || {}).schemas);
    } catch (e) {
      console.warn(`⚠️ Dokumentasi gagal diambil dari ${s.url}`);
    }
  }
  return merged;
}

app.get('/openapi.json', async (req, res) => res.json(await buildSpec()));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, { 
    swaggerOptions: { url: '/openapi.json' } 
}));

// ==========================================
// PROXY MIDDLEWARE (LAB 09)
// ==========================================
app.use('/product-service', createProxyMiddleware({
  target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: { '^/product-service': '' },
}));

app.use('/order-service', createProxyMiddleware({
  target: process.env.ORDER_SERVICE_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: { '^/order-service': '' },
}));

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Gateway berjalan di port :${PORT}`);
  console.log(`📚 Dokumentasi API tersedia di http://localhost:${PORT}/docs`);
});