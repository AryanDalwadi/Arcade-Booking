# Arcade Booking Microservices Learning Platform

An interview-focused reference application for learning how a React and
TypeScript client evolves into an event-driven Node.js microservices platform.
The target runtime uses PostgreSQL, Kafka, Redis, Docker, Kubernetes, CI/CD,
and AWS.

## Architecture

```text
React web → API Gateway → Identity / Catalog / Booking / Payment
                              │
                              └→ Kafka → Inventory / Notification / Analytics

Redis      → cache, rate limits, booking holds, idempotency
PostgreSQL → service-owned transactional data
```

`booking-service` is the arcade-domain equivalent of a generic order service.
Every microservice owns its data and communicates through APIs or versioned
events; services never query another service's tables.

## Repository layout

```text
apps/
  web/                    React + Vite + TypeScript
  api-gateway/            Public API edge
services/
  identity/               Login, registration, users, user groups
  catalog/                Games, machines, pricing
  booking/                Reservations and transactional outbox
  payment/                Idempotent simulated payment adapter
  inventory/              Machine availability projection
  notification/           Notification event consumer
  analytics/              Analytics event consumer/projection
packages/
  contracts/              Versioned API and event schemas
  service-auth/           Shared JWT claim and role middleware
infra/
  docker/                 Local integrated environment
  k8s/                    Kubernetes manifests (learning target)
  aws/                    AWS target map (Terraform; not a live account)
docs/                     Learning and interview guides
backend/                   Legacy backend retained during migration
frontend/                  Legacy frontend retained during migration
```

## Local development

Prerequisites: Node.js 20+, npm 10+, and Docker Desktop.

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Use `infra/docker-compose.yml` for the integrated PostgreSQL,
Kafka, Redis, gateway, web, and service environment. Copy `.env.example`
files locally and never commit secrets.

## Learning path

Start with [the learning roadmap](docs/LEARNING_ROADMAP.md), then use the
milestone guides, [admin and customer portal guide](docs/ADMIN_CUSTOMER_PORTALS.md),
[Kafka guide](docs/MILESTONE_06_KAFKA.md),
[Redis guide](docs/MILESTONE_07_REDIS.md),
[Twelve-Factor guide](docs/MILESTONE_08_TWELVE_FACTOR.md),
[Docker guide](docs/MILESTONE_09_DOCKER.md),
[CI/CD guide](docs/MILESTONE_10_CICD.md),
[Kubernetes guide](docs/MILESTONE_11_KUBERNETES.md),
[AWS map](docs/MILESTONE_12_AWS.md),
[SQL vs DynamoDB](docs/MILESTONE_13_DYNAMODB.md),
and [interview guide](docs/INTERVIEW_GUIDE.md). Infrastructure files are
educational deployment starters; they do not imply that an AWS environment has
already been provisioned.

GitHub: [Arcade-Booking](https://github.com/AryanDalwadi/Arcade-Booking)
