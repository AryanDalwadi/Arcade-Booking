# Milestone 4 — Identity Microservice

## Goal

Identity is a bounded context that owns registration, login, users, groups,
password hashes, and token issuance. Other services do not query its tables.
The browser reaches it only through the API Gateway.

## Request flow

```text
React
  → POST /api/identity/auth/login
  → API Gateway (public route, CORS, correlation ID, rate limit)
  → POST /v1/auth/login
  → Identity Service
  → identity PostgreSQL database
  → bcrypt password comparison
  → signed JWT containing sub and roles
  → React stores the session
```

For a protected request, the gateway verifies issuer, audience, signature, and
expiry. It removes caller-supplied `x-auth-*` headers, then forwards trusted
identity headers derived from the token.

## Why this is a separate service

- Password and token code stays inside one security boundary.
- Identity data has one owner and one migration history.
- Authentication can be deployed and scaled independently.
- Booking, payment, and catalog services do not handle password hashes.

The trade-off is network and operational complexity. A small application would
normally start as a modular monolith; this split is justified here as a
microservices learning exercise.

## Data ownership

Database: `identity`

- `users`: email, display name, bcrypt password hash
- `user_groups`: named groups
- `user_group_members`: many-to-many user membership

Passwords are never stored or returned as plaintext. Service code uses
parameterized PostgreSQL queries, and migrations own table changes.

## Security decisions

- bcrypt cost factor 12 for registration
- generic `Invalid credentials` response for unknown user or wrong password
- duplicate email returns `409 EMAIL_ALREADY_REGISTERED`
- short-lived JWT configured through `JWT_EXPIRES_IN`
- explicit JWT issuer and audience
- production rejects the development JWT secret
- gateway strips spoofed internal identity headers
- Docker PostgreSQL is published only on `127.0.0.1:5433` for local inspection

## Health and shutdown

- `GET /health/live`: the process is running
- `GET /health/ready`: required dependencies are ready
- SIGINT/SIGTERM stop new HTTP work, close adapters, and exit cleanly

## Verification

```powershell
npm run typecheck -w @arcade/identity-service
npm test -w @arcade/identity-service
npm test -w @arcade/api-gateway
docker compose -f infra/docker-compose.yml ps identity gateway postgres
```

The tests cover password hashing, password-hash redaction, duplicate email,
scoped JWT issuance, production-secret validation, gateway authentication, and
trusted-header replacement.

## Known next security step

Authentication is implemented, but fine-grained authorization is intentionally
the next exercise. User-group management endpoints should enforce ADMIN/STAFF
policies in the owning service, and the React navigation should hide actions the
current role cannot perform. Gateway authentication does not replace
service-level authorization.

## Interview answer

> The Identity Service owns users, password hashes, groups, and JWT issuance.
> Registration validates input and stores a bcrypt hash in its own PostgreSQL
> database. Login uses one generic failure response, compares the hash, and
> signs a short-lived token with a subject, roles, issuer, and audience. The API
> Gateway verifies that token for protected routes, removes untrusted internal
> identity headers, and forwards claims to internal services. This separation
> keeps password handling out of booking and payment, but it adds network and
> deployment complexity. PostgreSQL is the source of truth, configuration is
> externalized, and liveness, readiness, graceful shutdown, and focused
> authentication tests make the service operable.
