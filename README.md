@'
# Toko Microservices — Lab 13 (Containerization & Docker Compose)

Arsitektur microservices berbasis Node.js (Express) dan RabbitMQ yang dijalankan secara terorkestrasi menggunakan Docker Compose.

## Arsitektur & Port

| Service | Akses | Port | Keterangan |
| :--- | :--- | :--- | :--- |
| **gateway** | Publik (Host) | `8080` | Reverse proxy (`/product-service`, `/order-service`), Swagger UI (`/docs`), Healthcheck (`/health`) |
| **rabbitmq** | Publik & Internal | `15672` (UI), `5672` (AMQP) | Message broker untuk komunikasi asinkron antar-service |
| **product-service** | Internal Docker | `3000` | Manajemen katalog & stok produk |
| **order-service** | Internal Docker | `3001` | Pemrosesan pesanan & publish event ke RabbitMQ |
| **notification-service** | Internal Docker | - | Consumer antrean `notification-queue` dari RabbitMQ |

## Cara Menjalankan Stack

1. Pastikan Docker Desktop sudah berjalan.
2. Jalankan seluruh stack dari root repository:
   ```bash
   docker compose up -d --build