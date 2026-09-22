# Milestone 13: SQL vs NoSQL (DynamoDB projection)

## Goal

Learn **when PostgreSQL is the truth** and when a **DynamoDB-shaped
projection** is only a dashboard copy.

This milestone does **not** create a DynamoDB table in AWS. The Terraform flag
`enable_dynamodb_analytics_projection` stays **false**. On the laptop the same
partition/sort keys live in memory so you can test duplicates without a bill.

## Two kinds of database

| | PostgreSQL (SQL) | DynamoDB-style projection |
| --- | --- | --- |
| Job | Bookings, payments, users | “How busy was today?” |
| Strength | Constraints, joins, transactions | Fast GetItem by a known key |
| This arcade | **Source of truth** (`event_facts`) | Derived minutes per day |

A projection can lag. The dashboard shows **freshness**. If logic changes,
**rebuild** from PostgreSQL facts (`POST /v1/utilization/rebuild`).

## Queries first, then keys

1. Minutes reserved for the venue on a day → `GetItem` `pk=VENUE#arcade` `sk=DAY#2026-09-22`
2. Minutes reserved for a machine on a day → `GetItem` `pk=MACHINE#{id}` `sk=DAY#2026-09-22`

No extra index. The catalog has no separate venue table, so venue id is
`arcade` (one site). One venue partition is a **known hot-key risk** at huge
scale; it is fine for this arcade.

Minutes increment on **`arcade.inventory.reserved.v1`** (the slot is real), not
on booking-created (payment might still fail).

## Idempotency

Kafka can deliver twice. The item stores `appliedBookingIds`. A second event
for the same booking **does not add minutes again**.

An **older** `occurredAt` for a **different** booking still counts. Freshness
is the **latest** `occurredAt`, not “last writer wins the total.”

## Files

| File | Role |
| --- | --- |
| `services/analytics/src/projection/keys.ts` | Named queries and pk/sk |
| `services/analytics/src/projection/memory-store.ts` | Same item shape as DynamoDB, in RAM |
| `services/analytics/tests/projection.test.ts` | Duplicate + out-of-order |
| `GET /api/analytics/utilization` | Staff/admin dashboard copy |
| Terraform DynamoDB table | Still **off** until you flip the AWS flag later |

## How to verify

```powershell
npm test -w @arcade/analytics-service
npm test -w @arcade/api-gateway
```

On http://localhost:3000 sign in as **staff/admin**. After a confirmed booking
(inventory reserved), the admin dashboard shows reserved minutes and freshness.

Customers cannot call `/api/analytics`.

## What is still not AWS DynamoDB

- No `terraform apply`
- Memory store is lost if the analytics container restarts (rebuild from SQL)
- A real Dynamo table would use the same keys and a condition
  `bookingId not already applied`

## Interview answer

> I pick storage from invariants and access patterns. PostgreSQL owns bookings
> because they need constraints and transactions. DynamoDB is justified only as
> a derived analytics view, here daily reserved minutes by venue and machine,
> with keys designed from those two GetItem queries and no speculative GSI.
> Kafka updates the projection with an idempotent write; the dashboard shows
> freshness because the copy is eventually consistent. I can rebuild from the
> SQL event log. Polyglot persistence is extra cost; I would not add DynamoDB
> without that query.
