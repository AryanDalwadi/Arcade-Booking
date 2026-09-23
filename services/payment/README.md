# Payment service

Owns the **payment** bounded context and its PostgreSQL schema/database. It never reads another service's tables.

## Run

Build `packages/contracts` first, then run `npm install`, `npm run migrate`, and `npm run dev` in this directory. Copy `.env.example` to `.env`.

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- API base: `/v1`

Kafka/Redis startup failures are logged with the dependency name. The process remains alive where safe, but readiness stays false until required dependencies connect. SIGTERM/SIGINT stop HTTP acceptance and close adapters.

## Ownership

Database: `arcade_payment`. Migrations in `migrations/` create only this service's tables.

Inventory reservation creates a **PENDING** payment. Customers then create a Razorpay **TEST** order (`POST /v1/orders`). The webhook `POST /v1/webhooks/razorpay` is the source of truth for capture/failure. If `RAZORPAY_KEY_ID` is unset, the labeled **SIMULATED** provider is used so CI never calls the network. This is not a live charge.

