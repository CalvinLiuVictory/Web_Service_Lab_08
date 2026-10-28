// const express = require('express');
// const { createProxyMiddleware } = require('http-proxy-middleware');
// const { rateLimit } = require('express-rate-limit');
// require('dotenv').config();

// const app = express();

// // Diperlukan saat di-deploy ke platform seperti Vercel/Render agar membaca IP asli klien
// app.set('trust proxy', 1);

// // 1. RATE LIMITING: Maksimal 20 request per 10 detik per IP
// const limiter = rateLimit({
//   windowMs: 10 * 1000,
//   limit: 20,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { error: 'Terlalu banyak request, coba lagi nanti (429 Too Many Requests)' }
// });
// app.use(limiter);

// // 2. MIDDLEWARE API KEY
// const requireApiKey = (req, res, next) => {
//   const apiKey = req.get('X-API-Key');
//   const validKey = process.env.API_KEY || 'kelompok-123'; // Pastikan sama dengan di Postman

//   if (!apiKey || apiKey !== validKey) {
//     return res.status(401).json({ error: 'Unauthorized: Header X-API-Key tidak valid atau hilang' });
//   }
//   next();
// };

// // 3. ROUTING PROXY
// // Jangan pasang app.use(express.json()) sebelum fungsi proxy ini
// app.use(
//   '/train-service',
//   requireApiKey,
//   createProxyMiddleware({
//     target: process.env.SERVICE_TRAIN_URL || 'http://localhost:3000',
//     changeOrigin: true,
//     pathRewrite: { '^/train-service': '' }, 
//   })
// );

// // Fallback 404
// app.use((req, res) => res.status(404).json({ error: 'Route Gateway tidak ditemukan' }));

// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => console.log(`🚀 API Gateway berjalan di http://localhost:${PORT}`));


// Lab 09 Start //

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

// Opsional: Jika ingin tetap pakai API Key, aktifkan ini. Jika tidak, hapus saja.
const requireApiKey = (req, res, next) => {
  const apiKey = req.get('X-API-Key');
  const validKey = process.env.API_KEY || 'kelompok-123';
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// 1. ROUTING KE PRODUCT SERVICE (Port 3000)
app.use(
  '/product-service',
  requireApiKey,
  createProxyMiddleware({
    target: 'http://127.0.0.1:3000', // Menggunakan 127.0.0.1 untuk menghindari error fetch Node 18+
    changeOrigin: true,
    pathRewrite: { '^/product-service': '' },
  })
);

// 2. ROUTING KE ORDER SERVICE (Port 3001)
app.use(
  '/order-service',
  requireApiKey,
  createProxyMiddleware({
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    pathRewrite: { '^/order-service': '' },
  })
);

// Fallback 404
app.use((req, res) => res.status(404).json({ error: 'Route Gateway tidak ditemukan' }));

const PORT = 8080;
app.listen(PORT, () => console.log(`🚀 Gateway Microservices berjalan di http://localhost:${PORT}`));