# Identity service

Owns the **identity** bounded context and its PostgreSQL schema/database. It never reads another service's tables.

## Run

Build `packages/contracts` first, then run `npm install`, `npm run migrate`, and `npm run dev` in this directory. Copy `.env.example` to `.env`.

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`
- API base: `/v1`

Key APIs:

- `POST /v1/auth/register` and `POST /v1/auth/login`
- `GET /v1/users`
- `GET /v1/user-groups` and `POST /v1/user-groups`
- `POST /v1/user-groups/:groupId/users/:userId`

Kafka/Redis startup failures are logged with the dependency name. The process remains alive where safe, but readiness stays false until required dependencies connect. SIGTERM/SIGINT stop HTTP acceptance and close adapters.

## Ownership

Database: `identity` in Compose (`arcade_identity` is the standalone-development
default). Migrations in `migrations/` create only this service's tables.

See [`docs/MILESTONE_04_IDENTITY.md`](../../docs/MILESTONE_04_IDENTITY.md) for
the request flow, security decisions, verification steps, and interview answer.

