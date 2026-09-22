# Analytics service

Owns the **analytics** bounded context and its PostgreSQL schema/database. It never reads another service's tables.

## Run

Build `packages/contracts` first, then run `npm install`, `npm run migrate`, and `npm run dev` in this directory. Copy `.env.example` to `.env`.

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- API base: `/v1`
- Staff utilization: `GET /v1/utilization` (Dynamo-shaped projection; PostgreSQL `event_facts` is the log of record)

Kafka/Redis startup failures are logged with the dependency name. The process remains alive where safe, but readiness stays false until required dependencies connect. SIGTERM/SIGINT stop HTTP acceptance and close adapters.

## Ownership

Database: `arcade_analytics`. Migrations in `migrations/` create only this service's tables. 

