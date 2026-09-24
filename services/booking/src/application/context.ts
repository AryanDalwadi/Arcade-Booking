import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  bookingCreatedEventSchema,
  createBookingSchema,
  eventTypes,
  inventoryRejectedEventSchema,
  inventoryReleasedEventSchema,
  inventoryReservedEventSchema,
  paymentCompletedEventSchema,
  paymentFailedEventSchema,
} from '@arcade/contracts';
import { readAuthContext, requireAuth } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';
import { RedisAdapter } from '../adapters/redis';
import type { QuoteProvider } from '../adapters/catalog';
import type { SlotAvailability } from '../adapters/inventory';
import { HOLD_TTL_SECONDS, bookingHoldKeys } from './holds';

export async function handleBookingEvent(db: Postgres, event: unknown): Promise<void> {
  const eventType = (event as { eventType?: string })?.eventType;
  if (eventType === eventTypes.paymentCompleted || eventType === eventTypes.paymentFailed) {
    const parsed = eventType === eventTypes.paymentCompleted
      ? paymentCompletedEventSchema.parse(event)
      : paymentFailedEventSchema.parse(event);
    const paymentStatus = eventType === eventTypes.paymentCompleted ? 'COMPLETED' : 'FAILED';
    await db.query(
      `UPDATE bookings
       SET payment_status=$2,
           status=CASE
             WHEN $2='FAILED' THEN 'PAYMENT_FAILED'
             WHEN status IN ('PAYMENT_FAILED', 'CANCELLED') THEN status
             WHEN inventory_status='RESERVED' THEN 'CONFIRMED'
             ELSE 'PENDING_PAYMENT'
           END
       WHERE id=$1`,
      [parsed.payload.bookingId, paymentStatus],
    );
    return;
  }
  if (eventType === eventTypes.inventoryReleased) {
    const parsed = inventoryReleasedEventSchema.parse(event);
    await db.query(
      `UPDATE bookings
       SET inventory_status='RELEASED',
           status=CASE WHEN status='CONFIRMED' THEN status ELSE 'PAYMENT_FAILED' END
       WHERE id=$1`,
      [parsed.payload.bookingId],
    );
    return;
  }
  if (eventType === eventTypes.inventoryReserved || eventType === eventTypes.inventoryRejected) {
    const parsed = eventType === eventTypes.inventoryReserved
      ? inventoryReservedEventSchema.parse(event)
      : inventoryRejectedEventSchema.parse(event);
    const inventoryStatus = eventType === eventTypes.inventoryReserved ? 'RESERVED' : 'REJECTED';
    await db.query(
      `UPDATE bookings
       SET inventory_status=$2,
           status=CASE
             WHEN $2='REJECTED' THEN 'CANCELLED'
             WHEN payment_status='COMPLETED' THEN 'CONFIRMED'
             ELSE status
           END
       WHERE id=$1`,
      [parsed.payload.bookingId, inventoryStatus],
    );
  }
}

export function bookingRoutes(
  db: Postgres,
  redis: RedisAdapter,
  quotes: QuoteProvider,
  inventory: SlotAvailability,
): Router {
  const router = Router();
  router.post('/bookings', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const userId = auth.subject;
    const input = createBookingSchema.parse(req.body);
    const customerEmail = auth.email ?? input.customerEmail;
    let quote;
    try {
      quote = await quotes.quote(input.machineId, input.durationMinutes);
    } catch {
      return res.status(422).json({
        success: false,
        message: 'The selected machine cannot be priced for this booking',
        code: 'BOOKING_QUOTE_UNAVAILABLE',
      });
    }
    let available: boolean;
    try {
      available = await inventory.available(input.machineId, input.startAt, input.durationMinutes);
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Could not confirm machine availability',
        code: 'BOOKING_SLOT_CHECK_UNAVAILABLE',
      });
    }
    if (!available) {
      return res.status(409).json({
        success: false,
        message: 'This machine is already booked for that time',
        code: 'BOOKING_SLOT_UNAVAILABLE',
      });
    }
    const holdKeys = bookingHoldKeys(input.machineId, input.startAt, input.durationMinutes);
    const holdOwner = randomUUID();
    if (!(await redis.acquire(holdKeys, holdOwner, HOLD_TTL_SECONDS))) {
      return res.status(409).json({
        success: false,
        message: 'This machine and time slot is currently being booked',
        code: 'BOOKING_HOLD_EXISTS',
      });
    }
    try {
      const booking = await db.transaction(async (client) => {
        const result = await client.query(
          `INSERT INTO bookings(user_id,machine_id,start_at,duration_minutes,amount_cents,currency,status)
           VALUES($1,$2,$3,$4,$5,$6,'PENDING_PAYMENT') RETURNING *`,
          [userId,input.machineId,input.startAt,input.durationMinutes,quote.amountCents,quote.currency],
        );
        const row = result.rows[0];
        const event = bookingCreatedEventSchema.parse({
          eventId: randomUUID(), eventType: eventTypes.bookingCreated, version: 1,
          occurredAt: new Date().toISOString(), correlationId: randomUUID(), producer: 'booking',
          payload: {
            id: row.id,
            userId: row.user_id,
            machineId: row.machine_id,
            startAt: new Date(row.start_at).toISOString(),
            durationMinutes: row.duration_minutes,
            amountCents: row.amount_cents,
            currency: row.currency,
            ...(customerEmail ? { customerEmail } : {}),
          },
        });
        await client.query('INSERT INTO outbox(event_id,topic,payload) VALUES($1,$2,$3)', [event.eventId, event.eventType, event]);
        return row;
      });
      return res.status(201).json({ success: true, data: booking });
    } finally {
      await redis.delete(holdKeys);
    }
  });
  router.get('/bookings', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const userId = auth.subject;
    const roles = auth.roles;
    const canReadAll = roles.has('ADMIN') || roles.has('STAFF');
    const requestedUserId = canReadAll && req.query.userId ? String(req.query.userId) : userId;
    const values = canReadAll && !req.query.userId ? [] : [requestedUserId];
    const sql = values.length
      ? 'SELECT * FROM bookings WHERE user_id=$1 ORDER BY created_at DESC'
      : 'SELECT * FROM bookings ORDER BY created_at DESC';
    res.json({ success: true, data: (await db.query(sql, values)).rows });
  });
  return router;
}

