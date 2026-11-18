(async () => {
  console.log('--- Pengujian Rate Limit Gateway (Target: 20 Req/10 Detik) ---');
  for (let i = 1; i <= 25; i++) {
    try {
      const res = await fetch('http://localhost:8080/train-service/api/schedules', {
        headers: { 'X-API-Key': 'kelompok-123' }
      });
      console.log(`Request #${i} -> Status Code: ${res.status}`);
    } catch (err) {
      console.error(`Request #${i} Failed:`, err.message);
    }
  }
})();