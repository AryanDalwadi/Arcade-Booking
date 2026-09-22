# Milestone 7: Redis Cache, Holds, Rate Limits, and Fail-Open

## Goal

Use Redis for **fast temporary state**. PostgreSQL remains the booking ledger.
Kafka remains the saga messenger. This milestone hardens cache, checkout holds,
and gateway rate limits that already talk to the `redis` container.

It does not deploy AWS ElastiCache.

## Why Redis

HTTP and PostgreSQL are too slow or too heavy for:

- repeating the same machine list every request
- two people clicking Book on the same slot in the same second
- counting requests across gateway replicas

Redis is the wrong tool for:

- who owns a machine for 90 minutes (Inventory + PostgreSQL)
- whether a payment already happened (Payment PostgreSQL unique key)
- durable events (Kafka + outbox)

If Redis expires, evicts, or crashes, the arcade must still book correctly.

## Files

| File | Role |
| --- | --- |
| `infra/docker-compose.yml` | `redis` container; gateway `RATE_LIMIT_STORE=redis` |
| `services/catalog/src/adapters/redis.ts` | Cache get/set/delete fail open |
| `services/catalog/src/application/context.ts` | Cache-aside `GET /machines` |
| `services/booking/src/application/holds.ts` | 15-minute hold slot keys |
| `services/booking/src/adapters/redis.ts` | Atomic multi-slot `SET` |
| `services/booking/src/application/context.ts` | 120s hold before insert |
| `apps/api-gateway/src/rate-limit.ts` | Redis counters; fail-open on outage |
| `services/payment/src/application/context.ts` | Idempotency in PostgreSQL, not Redis |

## Keys

```text
catalog:machines:v1
booking:hold:{machineId}:{slotStartIso}
arcade:gateway:rate-limit:{clientIp}
```

Every key has a namespace, an owner service, and a TTL (cache 60s, hold 120s,
rate-limit window).

## Flow

```text
GET /api/catalog/machines
        │
        ├─ Redis hit  → return cache: hit
        └─ Redis miss → PostgreSQL → SET EX 60 → cache: miss
           Redis down → PostgreSQL → cache: bypass

POST /api/booking/bookings
        │
        ├─ Redis hold on every 15-minute slot in the range
        │     taken → HTTP 409 BOOKING_HOLD_EXISTS
        │     Redis down → continue (fail-open)
        └─ PostgreSQL INSERT PENDING_PAYMENT
                └─ Kafka saga (Inventory still decides overlap)
```

## Cache-aside

Catalog never treats Redis as the machine table.

1. Read Redis.
2. On miss or outage, read PostgreSQL.
3. Write Redis with a 60 second TTL.
4. After `POST /machines`, delete the key so the next list is fresh.

Corrupt JSON is deleted and treated as a miss.

## Booking holds

A hold is `SET` on each 15-minute bucket covered by `startAt` + duration.

A 90-minute booking at 11:15 and a 60-minute booking at 11:45 share buckets,
so the second click can get **409** while the first hold is alive. That is
contention control, not the reservation.

Inventory's advisory lock and overlap query remain the correctness boundary.
After 120 seconds the hold keys expire even if the HTTP client is gone.

## Rate limits

Compose sets `RATE_LIMIT_STORE=redis` so two gateway processes share one
counter. The increment is atomic (`INCR` + `PEXPIRE`).

If Redis is down, the gateway **fails open**: it logs the error and still
proxies the request. Availability wins over abuse protection until Redis
returns. Login and booking still require JWT.

## Idempotency is not Redis here

Payment uses `idempotency_key` unique in PostgreSQL (`booking:{bookingId}`).
Money must survive Redis eviction. Redis is a reasonable place for HTTP
idempotency *results* in other APIs; this platform keeps the charge record
next to the payment row.

## What is still not production Redis

- Single Compose Redis, AOF on, no replica
- No AWS ElastiCache
- No cache stampede lock (catalog is small; 60s TTL is enough)
- Rate-limit fail-open (a hostile client can retry during an outage)

## How to verify

1. List machines twice: first `cache: miss` (or `bypass` if Redis is down),
   second `cache: hit`.
2. Create a machine as staff; the next list should miss again.
3. Book the same machine for overlapping 60 and 90 minute windows within two
   minutes: one **409** or later Kafka **CANCELLED**, never two **CONFIRMED**.
4. Stop Redis: catalog still lists from PostgreSQL; booking can still insert;
   Inventory still rejects overlap.

## Interview answer

> Redis is temporary state for the arcade platform, not the booking ledger.
> Catalog uses cache-aside with a namespaced TTL and invalidates on writes.
> Booking takes a 120-second hold across 15-minute slots so overlapping clicks
> collide early, but PostgreSQL and Inventory still decide who is reserved.
> The gateway stores rate-limit counters in Redis so replicas share one limit
> and fails open if Redis is unreachable. Payment idempotency stays in
> PostgreSQL because a charge must not disappear when a cache key expires.
> The main risks are stale cache, hold expiry mid-request, and confusing a
> hold with a reservation. I treat those as product policies, not as Redis
> replacing the database.
