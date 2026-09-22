# Milestone 8: Twelve-Factor Applications

## Goal

Make each arcade process portable: the **same build** runs on a laptop, in
Compose, or later on a cluster. Configuration, logs, and shutdown come from the
environment and the OS, not from code edits.

This milestone does not deploy Kubernetes or AWS.

## The twelve factors, mapped here

| Factor | Arcade mapping |
| --- | --- |
| Codebase | One git repo, many deployable workspaces |
| Dependencies | Declared in each `package.json`; images install from the lock |
| Config | Env vars parsed by Zod (`DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`) |
| Backing services | PostgreSQL, Kafka, Redis attached by URL, not hostname in source |
| Build, release, run | `npm run build` artifact + env at start time |
| Processes | Stateless: no required files on disk after boot |
| Port binding | `PORT` + `server.listen` |
| Concurrency | Scale by running more containers |
| Disposability | SIGTERM → readiness 503 → drain → close adapters |
| Dev/prod parity | Compose uses the same images and env shape |
| Logs | One JSON object per line on stdout/stderr |
| Admin processes | `npm run migrate` is a one-off, not hidden inside `index.ts` |

## Files

| File | Role |
| --- | --- |
| `packages/observability/src/index.ts` | JSON logs, secret redaction, shutdown helper |
| `services/*/src/config/env.ts` | Local defaults; production requires backing URLs |
| `services/*/src/http/app.ts` | `/health/live` stays up; `/health/ready` fails while draining |
| `services/*/src/index.ts` | Listen, structured start log, SIGTERM |
| `services/*/src/config/migrate.ts` | Explicit SQL one-off |
| `infra/docker/node.Dockerfile` | `MIGRATE_ON_START` local release hook |
| `apps/api-gateway/src/server.ts` | Drain `/health` to 503, JSON logs |

## Config

Local and test still have defaults so `npm test` works without Docker.

`NODE_ENV=production` **rejects** missing `DATABASE_URL`, `REDIS_URL`, and
`KAFKA_BROKERS`. Identity and the gateway also reject the development JWT
secret. Startup logs call `publicConfig()` so passwords and `JWT_SECRET` never
appear on stdout.

```text
{"ts":"...","level":"info","message":"service.listen","service":"booking","port":4103,"config":{"DATABASE_URL":"postgres://***:***@postgres:5432/booking"}}
```

## Logs

`log(level, message, fields)` writes one JSON line. `LOG_LEVEL` filters
(`debug` / `info` / `warn` / `error`). Errors go to stderr.

Do not write application logs to files inside the container. Compose and later
CloudWatch collect the stream.

## Disposability

```text
SIGTERM
  → acceptingTraffic = false
  → GET /health/ready  → 503 shuttingDown
  → GET /health/live   → 200 (process still alive)
  → stop outbox timer
  → server.close() drains in-flight HTTP
  → close PostgreSQL, Kafka, Redis
  → exit 0
```

Kubernetes (Milestone 11) uses that 503 to stop sending new traffic before the
process exits. Live stays 200 so the kubelet does not kill a process that is
still draining.

## Migrations

`npm run migrate -w @arcade/booking-service` applies `migrations/*.sql` and
exits. `index.ts` does **not** migrate.

Compose still runs migrate before `npm start` when `MIGRATE_ON_START=true`
(the local default). That is a **release** step in one container, not a secret
inside the Node listener. A future cluster should run migrate as a Job, then
start replicas with `MIGRATE_ON_START=false`.

## What is still not production Twelve-Factor

- Env vars are not a secret manager (use a vault on AWS later)
- Compose still chains migrate+start for convenience
- Single replica per service in Compose
- No log aggregator yet

## How to verify

```powershell
npm test -w @arcade/observability
npm test -w @arcade/booking-service
npm test -w @arcade/api-gateway
```

Watch booking logs: `docker compose -f infra/docker-compose.yml logs -f booking`.
You should see JSON `service.listen` **without** the database password.

## Interview answer

> I apply Twelve-Factor so an arcade service is the same binary everywhere.
> Dependencies are declared, config and backing URLs come from the environment,
> and production refuses to boot on local defaults. The process is stateless:
> PostgreSQL, Kafka, and Redis hold durable state. Logs are JSON lines on
> stdout. On SIGTERM the process marks itself unready, drains HTTP, then closes
> adapters. Migrations are `npm run migrate`, not a hidden side effect of
> `listen()`. Env vars still need validation and are not a secret store.
