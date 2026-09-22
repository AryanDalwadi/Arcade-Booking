# Payment service

Owns the **payment** bounded context and its PostgreSQL schema/database. It never reads another service's tables.

## Run

Build `packages/contracts` first, then run `npm install`, `npm run migrate`, and `npm run dev` in this directory. Copy `.env.example` to `.env`.

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- API base: `/v1`

Kafka/Redis startup failures are logged with the dependency name. The process remains alive where safe, but readiness stays false until required dependencies connect. SIGTERM/SIGINT stop HTTP acceptance and close adapters.

## Ownership

Database: `arcade_payment`. Migrations in `migrations/` create only this service's tables. The payment provider is intentionally **SIMULATED** for learning; no real charge occurs.

