    const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Diperlukan saat di-deploy ke Vercel/Render agar membaca IP asli klien
app.set('trust proxy', 1);

// 1. RATE LIMITING: Maksimal 20 request per 10 detik per IP
const limiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request, coba lagi nanti (429 Too Many Requests)' }
});
app.use(limiter);

// 2. TANTANGAN TAMBAHAN: Validasi API Key (Opsional / Nilai Plus)
const requireApiKey = (req, res, next) => {
  const apiKey = req.get('X-API-Key');
  const validKey = process.env.API_KEY || 'kelompok-123'; // Default key jika .env belum diisi

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized: Header X-API-Key tidak valid atau hilang' });
  }
  next();
};

// 3. ROUTING PROXY Ke Service Tiket Kereta (misal: /train-service/* -> Backend Anda)
// CATATAN: PENTING! Jangan pasang app.use(express.json()) sebelum fungsi proxy di bawah
app.use(
  '/train-service',
  requireApiKey, // Aktifkan middleware API Key
  createProxyMiddleware({
    target: process.env.SERVICE_TRAIN_URL || 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: { '^/train-service': '' }, // Menghapus prefix /train-service saat diteruskan
  })
);

// Fallback 404
app.use((req, res) => res.status(404).json({ error: 'Route Gateway tidak ditemukan' }));

const PORT = 8080;
app.listen(PORT, () => console.log(`🚀 API Gateway berjalan di port ${PORT}`));