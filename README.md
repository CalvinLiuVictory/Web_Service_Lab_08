# Sistem Toko Microservices

Sistem microservices sederhana yang terdiri dari Product Service, Order Service, Notification Service, dan API Gateway.

## Cara Menjalankan Sistem
Pastikan Docker RabbitMQ sudah berjalan di port 5672. Jalankan masing-masing service di terminal terpisah:
1. `cd product-service` -> `npm install` -> `node product-service.js` (Port: 3000)
2. `cd order-service` -> `npm install` -> `node order-service.js` (Port: 3001)
3. `cd notification-service` -> `npm install` -> `node notification-service.js` 
4. `cd gateway` -> `npm install` -> `node gateway.js` (Port: 8080)

## Dokumentasi API
Dokumentasi gabungan (Swagger UI) dapat diakses melalui API Gateway di: 
**http://localhost:8080/docs**

## Environment Variables
- `PORT`: Mengubah port service.
- `AMQP_URL`: URL RabbitMQ (default: `amqp://localhost`).
- `PRODUCT_SERVICE_URL`: URL dari product-service (untuk order-service).
- `PRODUCT_DOC_URL` & `ORDER_DOC_URL`: URL openapi.json untuk Gateway.