const amqp = require('amqplib');
const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost';
const QUEUE = process.argv.slice(2).find(a => !a.startsWith('--')) || 'notification-queue';
const CRASH = process.argv.includes('--crash');   // dipakai di langkah 07
const processed = new Set();                      // daftar messageId yang sudah diproses (memori)

async function main() {
  const conn = await amqp.connect(AMQP_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange('orders', 'fanout', { durable: true });
  await ch.assertQueue(QUEUE, { durable: true });
  await ch.bindQueue(QUEUE, 'orders', '');
  ch.prefetch(1);                                 // satu pesan per consumer pada satu waktu
  console.log(`[${QUEUE}] menunggu pesan...`);

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    let event;
    try { event = JSON.parse(msg.content.toString()); }
    catch { console.error('pesan rusak, dibuang'); return ch.nack(msg, false, false); }

    const id = msg.properties.messageId;
    if (processed.has(id)) { console.log('duplikat, dilewati:', id); return ch.ack(msg); }

    await new Promise(r => setTimeout(r, 1000)); // simulasi kirim email (1 detik)
    console.log(`[${QUEUE}] email terkirim: pesanan #${event.data.id} ${event.data.productName} x${event.data.qty}`);
    processed.add(id);

    if (CRASH) { console.log('crash sebelum ack!'); process.exit(1); }
    ch.ack(msg);                                  // beri tahu broker: selesai, boleh dihapus
  });
}
main().catch(e => { console.error(e.message); process.exit(1); });