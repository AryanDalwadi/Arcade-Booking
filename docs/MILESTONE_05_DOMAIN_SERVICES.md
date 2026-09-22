# Milestone 5: Arcade Domain Microservices

## Goal

Split the arcade workflow into bounded contexts with explicit ownership and
verify that they collaborate without sharing database tables.

The six contexts are:

- **Catalog** owns machines, games, pricing, and price quotes.
- **Booking** owns the customer reservation lifecycle and saga state.
- **Inventory** owns time-slot availability and overlap decisions.
- **Payment** owns idempotent charge records and simulated provider results.
- **Notification** records delivery work triggered by domain events.
- **Analytics** builds an independent event-fact projection.

Each service can change its internal schema independently. Cross-service data is
exchanged through HTTP contracts or versioned Kafka events.

## Booking request flow

1. A signed-in user sends a machine, start time, and duration to the gateway.
2. The gateway verifies the JWT and replaces all untrusted `x-auth-*` headers.
3. Booking reads the verified `x-auth-subject`; it never accepts a user ID from
   the request body.
4. Booking requests an authoritative quote from Catalog.
5. Catalog calculates the amount from its own `pricing` table.
6. Booking atomically stores the booking and an
   `arcade.booking.created.v1` outbox event.
7. Inventory consumes the event and serializes decisions per machine with a
   PostgreSQL transaction-scoped advisory lock.
8. Inventory stores either `RESERVED` or `REJECTED` and emits the matching
   event through its outbox.
9. Payment consumes only `arcade.inventory.reserved.v1`. A rejected slot is
   therefore never charged.
10. Booking consumes the Inventory and Payment results. A successful sequence
    becomes `CONFIRMED`; an overlap becomes `CANCELLED`.
11. Notification and Analytics consume the same events independently.

## Why Catalog owns the price

A browser is not a trusted pricing source. Previously the booking request could
send `amountCents: 1`, allowing the client to choose its charge.

Catalog now exposes:

```text
GET /v1/machines/:machineId/quote?durationMinutes=60
```

The endpoint only quotes active machines with configured pricing. Booking
persists the returned amount and publishes it in the booking event. No service
reads Catalog's database directly.

This is a useful microservice trade-off: the synchronous quote call improves
price correctness but means Catalog availability affects new bookings. A
production alternative is a versioned pricing projection inside Booking.

## Why identity comes from the gateway

Booking previously accepted `userId` in JSON and allowed an omitted query
filter to list every booking. An authenticated customer could therefore act as
another user or read other users' bookings.

Booking now:

- requires `x-auth-subject` supplied by the trusted gateway;
- uses that subject when inserting a booking;
- restricts normal users to their own booking list;
- permits an unfiltered list only for `ADMIN` or `STAFF`.

The gateway strips incoming `x-auth-*` headers before adding verified claims,
so clients cannot spoof this identity.

## Inventory consistency

A `SELECT` followed by an `INSERT` is unsafe when two consumers run
concurrently: both can observe an empty slot and both reserve it.

Inventory protects the invariant in two layers:

1. `pg_advisory_xact_lock` serializes reservation decisions for one machine.
2. A GiST exclusion constraint rejects overlapping `RESERVED` time ranges even
   if application locking is accidentally removed.

The Redis booking hold remains a short-lived contention optimization. It is not
the source of truth because different overlapping ranges produce different
Redis keys and Redis can be unavailable.

## Payment ordering and idempotency

Payment begins after Inventory emits `inventory.reserved`, not directly after
`booking.created`. This prevents charging a booking that Inventory rejects.

The payment idempotency key is `booking:<bookingId>` and is unique in
PostgreSQL. Re-delivery of the same event therefore returns the existing
payment rather than creating a second charge.

The provider remains intentionally simulated; this milestone teaches the
boundary and consistency pattern without contacting a real payment processor.
Manual payment simulation through HTTP is limited to `ADMIN` and `STAFF`.

## Verification

Automated checks:

```powershell
npm run build -w @arcade/contracts
npm run typecheck -w @arcade/catalog-service
npm run typecheck -w @arcade/booking-service
npm run typecheck -w @arcade/inventory-service
npm run typecheck -w @arcade/payment-service
npm test -w @arcade/booking-service
npm test -w @arcade/payment-service
```

The live Docker verification creates two overlapping bookings. Expected state:

- first booking: `CONFIRMED`, payment `COMPLETED`, inventory `RESERVED`;
- second booking: `CANCELLED`, no payment row, inventory `REJECTED`;
- Catalog-generated amount and currency are stored in Booking and Payment;
- Notification and Analytics record the resulting versioned events.

## Interview answer

> I split the arcade workflow into bounded contexts with database-per-service
> ownership. Catalog is authoritative for prices, Booking orchestrates customer
> state, Inventory enforces the no-overlap invariant, and Payment is idempotent.
> Services use a synchronous HTTP quote where an immediate answer is required
> and Kafka with transactional outboxes for workflow events. I ordered the saga
> so Inventory reserves before Payment charges, and I protect availability with
> both a PostgreSQL advisory lock and an exclusion constraint. This avoids
> trusting client prices, cross-user booking access, double booking, and charges
> for rejected reservations.
