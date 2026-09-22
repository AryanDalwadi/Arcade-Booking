import { Router } from 'express';
import { eventEnvelopeSchema, eventTypes, inventoryEventPayloadSchema } from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';
import { applyInventoryReserved } from '../projection/apply';
import { utcDay } from '../projection/keys';
import type { MemoryProjectionStore } from '../projection/memory-store';

export async function handleEvent(
  db: Postgres,
  event: unknown,
  projection?: MemoryProjectionStore | null,
  venueId = 'arcade',
): Promise<void> {
  const parsed = eventEnvelopeSchema.parse(event);
  const inserted = await db.transaction(async (client) => {
    if ((await client.query('SELECT 1 FROM processed_events WHERE event_id=$1', [parsed.eventId])).rowCount) {
      return false;
    }
    await client.query(
      `INSERT INTO event_facts(event_id,event_type,occurred_at,payload) VALUES($1,$2,$3,$4)`,
      [parsed.eventId, parsed.eventType, parsed.occurredAt, parsed.payload],
    );
    await client.query('INSERT INTO processed_events(event_id) VALUES($1)', [parsed.eventId]);
    return true;
  });
  if (inserted && projection) applyInventoryReserved(projection, parsed, venueId);
}

export function analyticsRoutes(
  db: Postgres,
  projection?: MemoryProjectionStore | null,
  venueId = 'arcade',
): Router {
  const router = Router();
  router.get('/facts', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    res.json({
      success: true,
      data: (await db.query('SELECT * FROM event_facts ORDER BY created_at DESC LIMIT 100')).rows,
    });
  });
  router.get('/utilization', requireAnyRole('ADMIN', 'STAFF'), async (req, res) => {
    const day = typeof req.query.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day)
      ? req.query.day
      : utcDay(new Date().toISOString());
    const venue = projection?.venueDay(venueId, day);
    const machines = (projection?.machinesForDay(day) ?? []).map((item) => ({
      machineId: item.pk.slice('MACHINE#'.length),
      minutes: item.minutes,
      bookingCount: item.bookingCount,
    }));
    res.json({
      success: true,
      data: {
        sourceOfTruth: 'postgresql',
        projection: projection ? 'memory-dynamo-keys' : 'off',
        venueId,
        day,
        venueMinutes: venue?.minutes ?? 0,
        bookingCount: venue?.bookingCount ?? 0,
        machines,
        freshness: venue?.lastOccurredAt ?? null,
      },
    });
  });
  router.post('/utilization/rebuild', requireAnyRole('ADMIN'), async (_req, res) => {
    if (!projection) {
      res.status(409).json({ success: false, message: 'Projection is off', code: 'PROJECTION_OFF' });
      return;
    }
    projection.reset();
    const rows = await db.query<{ occurred_at: string; payload: unknown }>(
      'SELECT occurred_at, payload FROM event_facts WHERE event_type=$1 ORDER BY occurred_at ASC',
      [eventTypes.inventoryReserved],
    );
    for (const row of rows.rows) {
      applyInventoryReserved(projection, {
        eventId: '00000000-0000-4000-8000-000000000000',
        eventType: eventTypes.inventoryReserved,
        version: 1,
        occurredAt: new Date(row.occurred_at).toISOString(),
        correlationId: '00000000-0000-4000-8000-000000000001',
        producer: 'rebuild',
        payload: inventoryEventPayloadSchema.parse(row.payload),
      }, venueId);
    }
    res.json({ success: true, data: { replayed: rows.rowCount ?? 0 } });
  });
  return router;
}
