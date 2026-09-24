import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  bookingCreatedEventSchema,
  eventTypes,
  inventoryRejectedEventSchema,
  inventoryReleasedEventSchema,
  inventoryReservedEventSchema,
  paymentCompletedEventSchema,
  paymentFailedEventSchema,
} from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';

type ReservationRow = {
  booking_id: string;
  machine_id: string;
  start_at: Date | string;
  duration_minutes: number;
  status: string;
};

export async function handleEvent(db: Postgres, event: unknown, holdSeconds = 600): Promise<void> {
  const eventType = (event as { eventType?: string })?.eventType;
  if (eventType === eventTypes.paymentCompleted) {
    const parsed = paymentCompletedEventSchema.parse(event);
    await db.query(
      `UPDATE reservations SET committed=true, hold_expires_at=NULL
       WHERE booking_id=$1 AND status='RESERVED'`,
      [parsed.payload.bookingId],
    );
    return;
  }
  if (eventType === eventTypes.paymentFailed) {
    const parsed = paymentFailedEventSchema.parse(event);
    await releaseReservation(db, parsed.payload.bookingId, 'Payment failed or unpaid hold expired');
    return;
  }
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
    const rejected = await slotIsReserved(client, p.machineId, p.startAt, p.durationMinutes);
    await client.query(
      `INSERT INTO reservations(booking_id,machine_id,start_at,end_at,duration_minutes,status,committed,hold_expires_at)
       VALUES($1,$2,$3,$3::timestamptz + make_interval(mins => $4::integer),$4::integer,$5,false,
              CASE WHEN $5='RESERVED' THEN now() + make_interval(secs => $6::integer) ELSE NULL END)
       ON CONFLICT(booking_id) DO NOTHING`,
      [p.id,p.machineId,p.startAt,p.durationMinutes,rejected ? 'REJECTED' : 'RESERVED', holdSeconds],
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
        userId: p.userId,
        ...(p.customerEmail ? { customerEmail: p.customerEmail } : {}),
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

export async function releaseReservation(db: Postgres, bookingId: string, reason: string): Promise<boolean> {
  return db.transaction(async (client) => {
    const updated = await client.query<ReservationRow>(
      `UPDATE reservations
       SET status='RELEASED', committed=false, hold_expires_at=NULL
       WHERE booking_id=$1 AND status='RESERVED'
         AND NOT (committed=true AND hold_expires_at IS NULL)
       RETURNING booking_id, machine_id, start_at, duration_minutes, status`,
      [bookingId],
    );
    const row = updated.rows[0];
    if (!row) return false;
    const released = inventoryReleasedEventSchema.parse({
      eventId: randomUUID(),
      eventType: eventTypes.inventoryReleased,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: row.booking_id,
      producer: 'inventory',
      payload: {
        bookingId: row.booking_id,
        machineId: row.machine_id,
        startAt: new Date(row.start_at).toISOString(),
        durationMinutes: row.duration_minutes,
        reason,
      },
    });
    await client.query('INSERT INTO outbox(event_id,topic,payload) VALUES($1,$2,$3)', [
      released.eventId,
      released.eventType,
      released,
    ]);
    return true;
  });
}

export async function expireUnpaidHolds(db: Postgres): Promise<number> {
  const stale = await db.query<ReservationRow>(
    `SELECT booking_id, machine_id, start_at, duration_minutes, status
     FROM reservations
     WHERE status='RESERVED' AND hold_expires_at IS NOT NULL AND hold_expires_at < now()
     ORDER BY hold_expires_at
     LIMIT 50`,
  );
  for (const row of stale.rows) {
    await releaseReservation(db, row.booking_id, 'Unpaid reservation hold expired');
  }
  return stale.rows.length;
}

export async function slotIsReserved(
  db: Pick<Postgres, 'query'>,
  machineId: string,
  startAt: string,
  durationMinutes: number,
): Promise<boolean> {
  const conflict = await db.query(
    `SELECT 1 FROM reservations WHERE machine_id=$1 AND status='RESERVED'
     AND start_at < $2::timestamptz + ($3 || ' minutes')::interval
     AND end_at > $2::timestamptz`,
    [machineId, startAt, durationMinutes],
  );
  return Boolean(conflict.rowCount);
}

export function inventoryRoutes(db: Postgres): Router {
  const router = Router();
  router.get('/availability', async (req, res) => {
    const machineId = String(req.query.machineId ?? '');
    const startAt = String(req.query.startAt ?? '');
    const durationMinutes = Number(req.query.durationMinutes);
    if (!machineId || !startAt || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({ success: false, message: 'machineId, startAt, and durationMinutes are required', code: 'VALIDATION_ERROR' });
    }
    const available = !(await slotIsReserved(db, machineId, startAt, durationMinutes));
    return res.json({
      success: true,
      data: { machineId, startAt, durationMinutes, available },
    });
  });
  router.get('/reservations', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    const table = 'reservations';
    res.json({ success: true, data: (await db.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 100`)).rows });
  });
  return router;
}
