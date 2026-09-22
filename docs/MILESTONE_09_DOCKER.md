# Milestone 9: Docker Images and Compose

## Goal

Package each arcade unit as a **repeatable lunchbox** (image). Compose starts
those boxes together on your laptop. Docker is packaging, not a cloud.

You already run Compose. This milestone hardens **how the image is built**.

It does not deploy Kubernetes or AWS.

## Image vs container

```text
Dockerfile  →  image (frozen recipe)
                 ↓
              container (running process)
```

`arcade-booking-booking` is an image. `arcade-booking-booking-1` is a container
from that image. Rebuild the image when code changes. Restarting a container
without `--build` keeps the old recipe.

## Files

| File | Role |
| --- | --- |
| `.dockerignore` | Keep git, `.env`, tests, and legacy apps out of the build context |
| `infra/docker/node.Dockerfile` | Multi-stage image for every Node service |
| `apps/api-gateway/Dockerfile` | Gateway-only image, `node dist/server.js` |
| `apps/web/Dockerfile` | Vite build → unprivileged nginx |
| `infra/docker-compose.yml` | Wires images to Postgres, Kafka, Redis |
| `infra/docker/policy.test.mjs` | Checks lockfile, `USER node`, no baked secrets |

## Multi-stage build

**Build stage (kitchen):** `npm ci` from `package-lock.json`, compile TypeScript.

**Runtime stage (plate):** copy `dist`, `migrations`, shared package `dist`
folders, and production `node_modules`. No tests, no compiler, no `.env`.

That is why the second `FROM node:22-alpine` exists. A single-stage image would
ship `tsc` and devDependencies forever.

## What is not in the image

- Database passwords (`DATABASE_URL` arrives at **container start**)
- `JWT_SECRET` (Compose injects it)
- Git history, `backend/`, `frontend/`, unit tests (`.dockerignore`)

The web image **does** bake `VITE_API_GATEWAY_URL` because the browser cannot
read Docker env. That URL is public (`http://localhost:4000`), not a secret.

## Non-root

Node services: `USER node`.  
Web: `nginxinc/nginx-unprivileged`.

```powershell
docker compose -f infra/docker-compose.yml exec booking whoami
```

Expected: `node`. Not `root`.

## Health and stop

- `HEALTHCHECK` in the Dockerfile pokes `/health/live`
- Compose uses the same idea so the UI shows green
- `STOPSIGNAL SIGTERM` + `stop_grace_period: 12s` give Milestone 8 time to drain
- `init: true` reaps zombie processes

Live stays 200 while draining; ready becomes 503. Compose currently checks
**live**, so a draining replica is not killed mid-request.

## Lockfile

`npm ci` installs the **exact** versions in `package-lock.json`. `npm install`
inside Docker can pick newer packages and produce “works on my machine” images.

## How to verify

```powershell
npm run test:dockerfiles
docker compose -f infra/docker-compose.yml exec booking whoami
docker compose -f infra/docker-compose.yml exec booking ls services/booking
docker image ls arcade-booking-booking
```

`ls` should show `dist`, `migrations`, `package.json` — not a `tests` folder.

## What is still not production Docker

- Compose still tags images `latest` locally; pass `GIT_SHA` as a build arg
  when you want the label on the image
- No image scan in this milestone (CI is next)
- Postgres/Kafka/Redis use version tags, not digests
- Single-host Compose, not a cluster

## Interview answer

> Docker gives each arcade service the same runtime everywhere. I use a
> multi-stage build: `npm ci` and `tsc` in the builder, then a small runtime
> with `dist`, migrations, and production modules only. The process runs as
> `node`, secrets come from Compose at start, logs go to stdout, and SIGTERM
> plus a health check describe the lifecycle. Compose is for local wiring.
> Orchestration and immutable promotion tags are later milestones.
