import { Router } from 'express';
import { gameSchema, machineQuoteSchema, machineSchema, pricingSchema } from '@arcade/contracts';
import { requireAuth, requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';
import { RedisAdapter } from '../adapters/redis';

const machinesCacheKey = 'catalog:machines:v1';

export function catalogRoutes(db: Postgres, redis: RedisAdapter): Router {
  const router = Router();
  router.get('/machines', requireAuth, async (_req, res) => {
    const cached = await redis.get(machinesCacheKey);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), cache: 'hit' });
    const rows = (await db.query('SELECT * FROM machines ORDER BY name')).rows;
    await redis.set(machinesCacheKey, JSON.stringify(rows), 60);
    return res.json({ success: true, data: rows, cache: 'miss' });
  });
  router.get('/machines/:machineId/quote', async (req, res) => {
    const durationMinutes = Number(req.query.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
      return res.status(400).json({
        success: false,
        message: 'durationMinutes must be an integer between 15 and 480',
        code: 'INVALID_DURATION',
      });
    }
    const result = await db.query<{
      machine_id: string;
      price_per_hour_cents: number;
      currency: string;
    }>(
      `SELECT m.id machine_id,p.price_per_hour_cents,p.currency
       FROM machines m
       INNER JOIN pricing p ON p.machine_id=m.id
       WHERE m.id=$1 AND m.status='ACTIVE'`,
      [req.params.machineId],
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Active machine pricing was not found',
        code: 'MACHINE_PRICE_NOT_FOUND',
      });
    }
    const quote = machineQuoteSchema.parse({
      machineId: row.machine_id,
      durationMinutes,
      amountCents: Math.ceil((row.price_per_hour_cents * durationMinutes) / 60),
      currency: row.currency.trim(),
    });
    return res.json({ success: true, data: quote });
  });
  router.post('/machines', requireAnyRole('ADMIN', 'STAFF'), async (req, res) => {
    const input = machineSchema.omit({ id: true }).parse(req.body);
    const row = (await db.query('INSERT INTO machines(name,status) VALUES($1,$2) RETURNING *', [input.name, input.status])).rows[0];
    await redis.delete(machinesCacheKey);
    res.status(201).json({ success: true, data: row });
  });
  router.get('/games', requireAuth, async (_req, res) => {
    const rows = (await db.query(
      'SELECT id,title,machine_id "machineId",created_at "createdAt" FROM games ORDER BY title',
    )).rows;
    res.json({ success: true, data: rows });
  });
  router.post('/games', requireAnyRole('ADMIN', 'STAFF'), async (req, res) => {
    const input = gameSchema.omit({ id: true }).parse(req.body);
    const row = (await db.query(
      'INSERT INTO games(title,machine_id) VALUES($1,$2) RETURNING id,title,machine_id "machineId",created_at "createdAt"',
      [input.title, input.machineId],
    )).rows[0];
    res.status(201).json({ success: true, data: row });
  });
  router.put('/pricing/:machineId', requireAnyRole('ADMIN', 'STAFF'), async (req, res) => {
    const input = pricingSchema.parse({ ...req.body, machineId: req.params.machineId });
    const row = (await db.query(
      'INSERT INTO pricing(machine_id,price_per_hour_cents,currency) VALUES($1,$2,$3) ON CONFLICT(machine_id) DO UPDATE SET price_per_hour_cents=$2,currency=$3 RETURNING *',
      [input.machineId, input.pricePerHourCents, input.currency],
    )).rows[0];
    res.json({ success: true, data: row });
  });
  return router;
}

