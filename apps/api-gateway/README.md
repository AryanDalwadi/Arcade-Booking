# Arcade API gateway

Express 5 and strict TypeScript edge service for the arcade platform.

## Routes

- `GET /health` is public.
- `/api/identity/*` proxies to `IDENTITY_SERVICE_URL`.
- `/api/catalog/*` proxies to `CATALOG_SERVICE_URL`.
- `/api/booking/*` proxies to `BOOKING_SERVICE_URL`.
- `/api/payment/*` proxies to `PAYMENT_SERVICE_URL`.

The gateway translates `/api/<service>/*` to each service's `/v1/*` API.
Identity login, register, and refresh are public; every other `/api/*` route
requires a valid Bearer JWT. It forwards trusted `sub`, `role`, and `roles`
claims as internal identity headers.

## Run

```bash
copy apps\api-gateway\.env.example apps\api-gateway\.env
npm install
npm run dev:gateway
```

Useful checks:

```bash
npm run typecheck -w @arcade/api-gateway
npm test -w @arcade/api-gateway
npm run build -w @arcade/api-gateway
```

## Operational behavior

Every response includes `x-correlation-id`; a caller-supplied value is reused
when reasonable. Helmet, allow-listed CORS, JWT verification, proxy timeouts,
and an IP-based fixed-window limiter are enabled. SIGINT/SIGTERM stop accepting
connections and drain active requests before the configured timeout.

The rate limiter depends on the `RateLimitStore` interface. The in-memory
implementation is suitable for local or single-instance use. Set
`RATE_LIMIT_STORE=redis` and `REDIS_URL` to use the atomic Redis implementation
when limits must be shared across gateway replicas.
