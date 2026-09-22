import { Router } from 'express';
import { eventEnvelopeSchema } from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';

export async function handleEvent(db: Postgres, event: unknown): Promise<void> {
  const parsed = eventEnvelopeSchema.parse(event);
    await db.transaction(async (client) => {
      if ((await client.query('SELECT 1 FROM processed_events WHERE event_id=$1', [parsed.eventId])).rowCount) return;
      await client.query(
        `INSERT INTO event_facts(event_id,event_type,occurred_at,payload) VALUES($1,$2,$3,$4)`,
        [parsed.eventId,parsed.eventType,parsed.occurredAt,parsed.payload],
      );
      await client.query('INSERT INTO processed_events(event_id) VALUES($1)', [parsed.eventId]);
    });
}
export function analyticsRoutes(db: Postgres): Router {
  const router = Router();
  router.get('/facts', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    const table = 'event_facts';
    res.json({ success: true, data: (await db.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 100`)).rows });
  });
  return router;
}

