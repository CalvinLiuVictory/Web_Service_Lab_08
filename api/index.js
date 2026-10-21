import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';

dotenv.config();
const app = express();

// --- 1. KEAMANAN: CORS & API GATEWAY RATE LIMITING ---
app.use(cors());
app.use(express.json());

// Membatasi maksimal 100 request per 15 menit dari 1 IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Terlalu banyak request, coba lagi nanti.' }
});
app.use('/api', limiter);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. MIDDLEWARE: AUTENTIKASI JWT (Umur Pendek) ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

  if (!token) return res.status(401).json({ error: 'Akses ditolak, token tidak ada' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token tidak valid atau sudah kedaluwarsa' });
    req.user = user;
    next();
  });
};

// --- 3. ENDPOINT AUTENTIKASI ---

// Register User
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, role',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'Registrasi berhasil', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Username mungkin sudah terpakai.' });
  }
});

// Login & Generate Token (TTL 15 Menit)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' });
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Password salah' });

    // Buat JWT token berumur pendek (15 menit)
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    
    res.json({ message: 'Login berhasil', token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 4. ENDPOINT JADWAL & HATEOAS LEVEL 3 ---
app.get('/api/schedules', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schedules');
    const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}`;
    
    const schedules = result.rows.map(sched => ({
      ...sched,
      _links: {
        self: { href: `${baseUrl}/api/schedules/${sched.id}`, method: 'GET' },
        book_seat: { href: `${baseUrl}/api/bookings`, method: 'POST', description: 'Gunakan token JWT untuk memanggil ini' }
      }
    }));
    
    res.json({ data: schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 5. ENDPOINT BOOKING (SEAT LOCKING DENGAN TTL 10 MENIT) ---
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { schedule_id, seat_number } = req.body;
    const user_id = req.user.id;

    await client.query('BEGIN'); // Transaksi Atomik

    // Cek apakah kursi sudah di-lock atau dibayar, dan TTL belum habis
    const checkSeat = await client.query(`
      SELECT * FROM bookings 
      WHERE schedule_id = $1 AND seat_number = $2 
      AND (status = 'PAID' OR (status = 'LOCKED' AND expires_at > NOW()))
    `, [schedule_id, seat_number]);

    if (checkSeat.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Kursi sedang di-lock oleh pengguna lain atau sudah terjual' });
    }

    // Jika kosong, Lock kursi selama 10 menit ke depan
    const result = await client.query(`
      INSERT INTO bookings (user_id, schedule_id, seat_number, status, expires_at)
      VALUES ($1, $2, $3, 'LOCKED', NOW() + INTERVAL '10 minutes')
      RETURNING *
    `, [user_id, schedule_id, seat_number]);

    await client.query('COMMIT');
    
    const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}`;
    const booking = result.rows[0];

    // HATEOAS untuk pembayaran
    res.status(201).json({
      message: 'Kursi berhasil di-lock selama 10 menit. Silakan lakukan pembayaran.',
      data: booking,
      _links: {
        pay: { href: `${baseUrl}/api/payments/${booking.id}`, method: 'POST' }
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- 6. ENDPOINT PEMBAYARAN (Simulasi Webhook / Payment) ---
app.post('/api/payments/:id', authenticateToken, async (req, res) => {
  const bookingId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Cek kepemilikan dan biarkan Database yang mengecek apakah waktu sudah habis
    const checkBooking = await pool.query(
      `SELECT *, (expires_at < NOW()) AS is_expired 
       FROM bookings WHERE id = $1 AND user_id = $2`,
      [bookingId, userId]
    );

    if (checkBooking.rows.length === 0) {
      return res.status(404).json({ error: 'Booking tidak ditemukan atau akses ditolak' });
    }

    const booking = checkBooking.rows[0];

    // 2. Validasi status
    if (booking.status === 'PAID') {
      return res.status(400).json({ error: 'Booking ini sudah lunas' });
    }

    // 3. Validasi TTL langsung dari hasil komputasi Database
    if (booking.is_expired) {
      await pool.query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`, [bookingId]);
      return res.status(400).json({ error: 'Batas waktu pembayaran 10 menit telah habis. Booking dibatalkan.' });
    }

    // 4. Eksekusi Pembayaran Berhasil
    await pool.query(`UPDATE bookings SET status = 'PAID' WHERE id = $1`, [bookingId]);

    res.json({ 
      message: 'Pembayaran berhasil diproses! Tiket kereta Anda telah terbit.',
      data: {
        booking_id: bookingId,
        status: 'PAID'
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wajib diekspor untuk Vercel Serverless
export default app;

// Jika dijalankan di lokal, hapus komentar di bawah ini:
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server Kereta Api berjalan di port ${PORT}`));