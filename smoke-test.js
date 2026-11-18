const BASE = process.env.BASE_URL || 'http://localhost:8080';

// Tambahkan header X-API-Key di sini agar diizinkan lewat oleh Gateway
const json = { 
  'Content-Type': 'application/json',
  'X-API-Key': 'kelompok-123' 
};

(async () => {
  try {
    console.log('--- Memulai Smoke Test ---');
    
    // Jangan lupa sesuaikan rutenya (misal /product-service) dengan yang ada di gateway.js Anda
    const list = await fetch(`${BASE}/product-service/products`, { headers: { 'X-API-Key': 'kelompok-123' } }).then(r => r.json());
    console.log('1. Jumlah produk:', list.length);
    
    const o = await fetch(`${BASE}/order-service/orders`, {
      method: 'POST', 
      headers: json, 
      body: JSON.stringify({ productId: 1, qty: 2 }) 
    });
    console.log('2. Buat order status:', o.status, await o.json());
    
    const p = await fetch(`${BASE}/product-service/products/1`, { headers: { 'X-API-Key': 'kelompok-123' } }).then(r => r.json());
    console.log('3. Stok produk 1 sekarang:', p.stock);
    
    console.log('--- Smoke Test Selesai ---');
  } catch (err) {
    console.error('Error saat testing:', err.message);
  }
})();