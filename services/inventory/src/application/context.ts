import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  bookingCreatedEventSchema,
  eventTypes,
  inventoryRejectedEventSchema,
  inventoryReservedEventSchema,
} from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';

export async function handleEvent(db: Postgres, event: unknown): Promise<void> {
  const parsed = bookingCreatedEventSchema.parse(event);
    await db.transaction(async (client) => {
      if ((await client.query('SELECT 1 FROM processed_events WHERE event_id=$1', [parsed.eventId])).rowCount) return;
      const p = parsed.payload;
      // Redis holds reduce contention, but this transaction-scoped database
      // lock is the correctness boundary for overlapping requests.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
        [p.machineId],
      );
      const conflict = await client.query(
        `SELECT 1 FROM reservations WHERE machine_id=$1 AND status='RESERVED'
         AND start_at < $2::timestamptz + ($3 || ' minutes')::interval
         AND end_at > $2::timestamptz`,
        [p.machineId,p.startAt,p.durationMinutes],
      );
      const rejected = Boolean(conflict.rowCount);
      await client.query(
        `INSERT INTO reservations(booking_id,machine_id,start_at,end_at,duration_minutes,status)
         VALUES($1,$2,$3,$3::timestamptz + make_interval(mins => $4::integer),$4::integer,$5)
         ON CONFLICT(booking_id) DO NOTHING`,
        [p.id,p.machineId,p.startAt,p.durationMinutes,rejected ? 'REJECTED' : 'RESERVED'],
      );
      const eventData = {
        eventId: randomUUID(),
        eventType: rejected ? eventTypes.inventoryRejected : eventTypes.inventoryReserved,
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: parsed.correlationId,
        producer: 'inventory',
        payload: {
          bookingId: p.id,
          machineId: p.machineId,
          startAt: p.startAt,
          durationMinutes: p.durationMinutes,
          amountCents: p.amountCents,
          currency: p.currency,
          ...(rejected ? { reason: 'Machine is already reserved for this time range' } : {}),
        },
      };
      const resultEvent = rejected
        ? inventoryRejectedEventSchema.parse(eventData)
        : inventoryReservedEventSchema.parse(eventData);
      await client.query(
        'INSERT INTO outbox(event_id,topic,payload) VALUES($1,$2,$3)',
        [resultEvent.eventId, resultEvent.eventType, resultEvent],
      );
      await client.query('INSERT INTO processed_events(event_id) VALUES($1)', [parsed.eventId]);
    });
}
export function inventoryRoutes(db: Postgres): Router {
  const router = Router();
  router.get('/reservations', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    const table = 'reservations';
    res.json({ success: true, data: (await db.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 100`)).rows });
  });
  return router;
}

