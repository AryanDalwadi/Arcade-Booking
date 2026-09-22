import { Router } from 'express';
import { eventEnvelopeSchema } from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';

export async function handleEvent(db: Postgres, event: unknown): Promise<void> {
  const parsed = eventEnvelopeSchema.parse(event);
    await db.query(
      `INSERT INTO deliveries(event_id,event_type,channel,recipient,status,payload)
       VALUES($1,$2,'EMAIL','demo@localhost','RECORDED',$3) ON CONFLICT(event_id) DO NOTHING`,
      [parsed.eventId,parsed.eventType,parsed.payload],
    );
}
export function notificationRoutes(db: Postgres): Router {
  const router = Router();
  router.get('/deliveries', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    const table = 'deliveries';
    res.json({ success: true, data: (await db.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 100`)).rows });
  });
  return router;
}

