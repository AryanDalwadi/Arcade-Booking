# Milestone 6: Kafka, Outbox, Idempotency, and DLQ

## Goal

Use Kafka for the booking saga so Booking does not call Inventory, Payment,
Notification, or Analytics over HTTP. The browser still uses HTTP. Kafka is
for reactions after a booking row is committed.

Kafka is already running as the `kafka` container in Docker Desktop. This
milestone hardens that path. It does not deploy AWS MSK.

## Why Kafka

HTTP is the right tool when the caller needs an immediate answer:

- login
- catalog quote
- create booking

Kafka is the right tool when other services should react later:

- Inventory reserves or rejects the slot
- Payment charges only after a reserve
- Notification records a delivery
- Analytics stores a fact

If Notification is down, Booking can still succeed. The event waits in Kafka
or in the outbox until the consumer is healthy again.

## Files

| File | Role |
| --- | --- |
| `packages/contracts/src/index.ts` | Event names, envelope, partition key, DLQ schema |
| `infra/docker-compose.yml` | `kafka`, `kafka-init`, topic list |
| `services/*/src/adapters/kafka.ts` | Producer, consumer, retries, DLQ |
| `services/booking/src/application/context.ts` | Booking row + outbox in one transaction |
| `services/booking/src/index.ts` | Outbox relay every second |
| `services/inventory/src/index.ts` | Consumes `booking.created` |
| `services/payment/src/index.ts` | Consumes `inventory.reserved` |
| `services/notification/src/index.ts` | Records deliveries |
| `services/analytics/src/index.ts` | Records event facts |

## Topics

```text
arcade.booking.created.v1
arcade.inventory.reserved.v1
arcade.inventory.rejected.v1
arcade.payment.completed.v1
arcade.payment.failed.v1
arcade.dead-letter.v1
```

`kafka-init` creates these topics at Compose start.

## Flow

```text
POST /api/booking/bookings
        │
        ▼
PostgreSQL transaction
  INSERT bookings
  INSERT outbox(event_id, topic, payload)
        │
        ▼  every 1 second
Outbox relay: Kafka publish with key = booking id
        │
        ├── Inventory
        │     processed_events skip duplicates
        │     reserve or reject
        │     outbox → inventory.reserved / rejected
        │
        ├── Payment
        │     only inventory.reserved
        │     outbox → payment.completed
        │
        └── Booking
              reserved + paid → CONFIRMED
              rejected → CANCELLED

Notification and Analytics consume independently.
```

## Outbox

Booking must not send Kafka inside the HTTP request as the only write. If Kafka
is down after PostgreSQL commits, the event would be lost.

The outbox row is committed with the booking. A relay publishes pending rows
and sets `published_at`. If the process crashes after Kafka accepts the message
but before `published_at` is set, the event may be sent twice. Consumers must
tolerate that.

## Message keys

`eventPartitionKey()` uses `payload.bookingId` or `payload.id`.

Kafka hashes that key onto a partition. Events for one booking stay in order
on that partition. Different bookings can run in parallel on other partitions.

## Idempotency

Kafka is at-least-once. Inventory stores `processed_events.event_id`.
Notification inserts `ON CONFLICT(event_id) DO NOTHING`. A duplicate delivery
does not create a second reservation or email row.

## Dead-letter queue

A handler is tried three times. After that, the adapter publishes
`arcade.dead-letter.v1` with:

- original topic, partition, offset
- attempt count
- error message
- original payload

The consumer then commits the offset, so one poison message does not block
the partition. Replay is a manual operator step: inspect the DLQ, fix the
consumer or payload, and republish.

This is a learning DLQ, not a full operations console.

## What is still not production Kafka

- Single-broker Compose Kafka, replication factor 1
- No AWS MSK
- No dedicated replay UI
- No schema registry

## How to verify

Create a booking in the customer portal, then inspect:

- `booking.outbox` — `published_at` is set
- `inventory.reservations`
- `payment.payments` only for reserved bookings
- `notification.deliveries`
- `analytics.event_facts`

Overlap the same machine and time: first booking `CONFIRMED`, second
`CANCELLED` with no payment row.

## Interview answer

> Booking commits its row and a `BookingCreatedV1` outbox event together, then
> a relay publishes to Kafka keyed by booking ID. Inventory, Payment,
> Notification, and Analytics consume independently. Kafka is at-least-once,
> so Inventory records processed event IDs. Payment waits for
> `inventory.reserved` so a rejected slot is not charged. After three handler
> failures the event goes to a dead-letter topic and the partition continues.
> HTTP remains the synchronous path for quotes and booking creation.
