import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  createPaymentSchema,
  eventTypes,
  inventoryReservedEventSchema,
  paymentCompletedEventSchema,
  paymentFailedEventSchema,
  type CreatePaymentRequest,
} from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';

/** Learning adapter only. It never contacts or charges a real provider. */
export class SimulatedPaymentProvider {
  charge(outcome: 'SUCCEED' | 'FAIL') { return { succeeded: outcome === 'SUCCEED', reference: 'sim_' + randomUUID() }; }
}

export async function processPayment(
  db: Postgres,
  input: CreatePaymentRequest,
  provider = new SimulatedPaymentProvider(),
) {
  return db.transaction(async (client) => {
    const existing = await client.query('SELECT * FROM payments WHERE idempotency_key=$1 FOR UPDATE', [input.idempotencyKey]);
    if (existing.rows[0]) return existing.rows[0];
    const outcome = provider.charge(input.simulateOutcome);
    const status = outcome.succeeded ? 'COMPLETED' : 'FAILED';
    const result = await client.query(
      `INSERT INTO payments(booking_id,amount_cents,currency,idempotency_key,status,provider,provider_reference)
       VALUES($1,$2,$3,$4,$5,'SIMULATED',$6) RETURNING *`,
      [input.bookingId,input.amountCents,input.currency,input.idempotencyKey,status,outcome.reference],
    );
    const row = result.rows[0];
    const eventData = {
      eventId: randomUUID(),
      eventType: status === 'COMPLETED' ? eventTypes.paymentCompleted : eventTypes.paymentFailed,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: input.bookingId,
      producer: 'payment',
      payload: {
        id: row.id,
        bookingId: row.booking_id,
        amountCents: row.amount_cents,
        currency: row.currency,
        status,
      },
    };
    const event = status === 'COMPLETED'
      ? paymentCompletedEventSchema.parse(eventData)
      : paymentFailedEventSchema.parse(eventData);
    await client.query('INSERT INTO outbox(event_id,topic,payload) VALUES($1,$2,$3)', [event.eventId,event.eventType,event]);
    return row;
  });
}

export async function handleInventoryReserved(db: Postgres, event: unknown): Promise<void> {
  const parsed = inventoryReservedEventSchema.parse(event);
  await processPayment(db, {
    bookingId: parsed.payload.bookingId,
    amountCents: parsed.payload.amountCents,
    currency: parsed.payload.currency,
    idempotencyKey: `booking:${parsed.payload.bookingId}`,
    simulateOutcome: 'SUCCEED',
  });
}

export function paymentRoutes(db: Postgres, provider = new SimulatedPaymentProvider()): Router {
  const router = Router();
  router.post('/payments', requireAnyRole('ADMIN', 'STAFF'), async (req, res) => {
    const input = createPaymentSchema.parse({ ...req.body, idempotencyKey: req.header('idempotency-key') ?? req.body?.idempotencyKey });
    const payment = await processPayment(db, input, provider);
    res.status(201).json({ success: true, data: payment });
  });
  router.get('/payments/:id', requireAnyRole('ADMIN', 'STAFF'), async (req, res) => {
    const row = (await db.query('SELECT * FROM payments WHERE id=$1', [req.params.id])).rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Payment not found' });
    return res.json({ success: true, data: row });
  });
  return router;
}

