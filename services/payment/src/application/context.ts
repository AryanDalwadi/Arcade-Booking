import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import {
  confirmRazorpayPaymentSchema,
  createPaymentOrderSchema,
  eventTypes,
  inventoryReservedEventSchema,
  paymentCompletedEventSchema,
  paymentFailedEventSchema,
  simulatePaymentSchema,
  type PaymentStatus,
} from '@arcade/contracts';
import { readAuthContext, requireAnyRole, requireAuth } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';
import type { OrderGateway } from '../adapters/razorpay';
import type { RequestWithRawBody } from '../http/app';

type PaymentRow = {
  id: string;
  booking_id: string;
  user_id: string | null;
  customer_email: string | null;
  amount_cents: number;
  currency: string;
  idempotency_key: string;
  status: PaymentStatus;
  provider: 'SIMULATED' | 'RAZORPAY';
  provider_reference: string;
  razorpay_order_id: string | null;
};

export type PaymentRouteOptions = {
  gateway: OrderGateway;
  webhookSecret?: string;
  keySecret?: string;
  publicKeyId: string;
};

/** Learning adapter only. It never contacts or charges a real provider. */
export class SimulatedPaymentProvider {
  charge(outcome: 'SUCCEED' | 'FAIL') { return { succeeded: outcome === 'SUCCEED', reference: 'sim_' + randomUUID() }; }
}

function publicPayment(row: PaymentRow) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    userId: row.user_id ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    amountCents: row.amount_cents,
    currency: row.currency,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    provider: row.provider,
  };
}

async function writePaymentEvent(client: PoolClient, row: PaymentRow, status: 'COMPLETED' | 'FAILED') {
  const eventData = {
    eventId: randomUUID(),
    eventType: status === 'COMPLETED' ? eventTypes.paymentCompleted : eventTypes.paymentFailed,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: row.booking_id,
    producer: 'payment',
    payload: {
      id: row.id,
      bookingId: row.booking_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      status,
      ...(row.customer_email ? { customerEmail: row.customer_email } : {}),
    },
  };
  const event = status === 'COMPLETED'
    ? paymentCompletedEventSchema.parse(eventData)
    : paymentFailedEventSchema.parse(eventData);
  await client.query('INSERT INTO outbox(event_id,topic,payload) VALUES($1,$2,$3) ON CONFLICT (event_id) DO NOTHING', [
    event.eventId,
    event.eventType,
    event,
  ]);
}

export async function finalizePayment(
  db: Postgres,
  paymentId: string,
  status: 'COMPLETED' | 'FAILED',
  providerReference: string,
) {
  return db.transaction(async (client) => {
    const locked = await client.query<PaymentRow>('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [paymentId]);
    const row = locked.rows[0];
    if (!row) return null;
    if (row.status === 'COMPLETED' || row.status === 'FAILED') return row;
    const updated = await client.query<PaymentRow>(
      `UPDATE payments SET status=$2, provider_reference=$3 WHERE id=$1 RETURNING *`,
      [paymentId, status, providerReference],
    );
    const next = updated.rows[0]!;
    await writePaymentEvent(client, next, status);
    return next;
  });
}

export async function expirePendingPayments(db: Postgres, holdSeconds: number): Promise<number> {
  const stale = await db.query<PaymentRow>(
    `SELECT * FROM payments
     WHERE status='PENDING' AND created_at < now() - make_interval(secs => $1::integer)
     ORDER BY created_at
     LIMIT 50`,
    [holdSeconds],
  );
  for (const row of stale.rows) {
    await finalizePayment(db, row.id, 'FAILED', `hold_timeout:${row.booking_id}`);
  }
  return stale.rows.length;
}

export async function handleInventoryReserved(db: Postgres, event: unknown): Promise<void> {
  const parsed = inventoryReservedEventSchema.parse(event);
  const p = parsed.payload;
  if (!p.userId) return;
  await db.query(
    `INSERT INTO payments(booking_id,user_id,customer_email,amount_cents,currency,idempotency_key,status,provider,provider_reference)
     VALUES($1,$2,$3,$4,$5,$6,'PENDING','SIMULATED','pending')
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      p.bookingId,
      p.userId,
      p.customerEmail ?? null,
      p.amountCents,
      p.currency,
      `booking:${p.bookingId}`,
    ],
  );
}

function signaturesMatch(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const received = Buffer.from(signature);
  const computed = Buffer.from(expected);
  return received.length === computed.length && timingSafeEqual(received, computed);
}

function checkoutPayload(payment: PaymentRow, options: PaymentRouteOptions, extra: { orderId: string; provider: PaymentRow['provider']; alreadyPaid?: boolean }) {
  return {
    bookingId: payment.booking_id,
    orderId: extra.orderId,
    keyId: options.publicKeyId,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    provider: extra.provider,
    ...(extra.alreadyPaid ? { alreadyPaid: true } : {}),
  };
}

export function paymentRoutes(db: Postgres, options: PaymentRouteOptions): Router {
  const router = Router();

  router.post('/webhooks/razorpay', async (req, res) => {
    const secret = options.webhookSecret;
    if (!secret) {
      return res.status(503).json({ success: false, message: 'Razorpay webhook secret is not configured', code: 'WEBHOOK_UNAVAILABLE' });
    }
    const payload = (req as RequestWithRawBody).rawBody ?? JSON.stringify(req.body ?? {});
    const signature = String(req.header('x-razorpay-signature') ?? '');
    if (!signature || !signaturesMatch(payload, signature, secret)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature', code: 'INVALID_WEBHOOK_SIGNATURE' });
    }
    const body = req.body as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    };
    const orderId = body.payload?.payment?.entity?.order_id;
    const paymentRef = body.payload?.payment?.entity?.id ?? `rzp_${randomUUID()}`;
    if (!orderId) {
      return res.status(202).json({ success: true, data: { ignored: true } });
    }
    const existing = await db.query<PaymentRow>('SELECT * FROM payments WHERE razorpay_order_id=$1', [orderId]);
    const row = existing.rows[0];
    if (!row) {
      return res.status(202).json({ success: true, data: { ignored: true } });
    }
    if (body.event === 'payment.captured') {
      await finalizePayment(db, row.id, 'COMPLETED', paymentRef);
    } else if (body.event === 'payment.failed') {
      await finalizePayment(db, row.id, 'FAILED', paymentRef);
    }
    return res.status(200).json({ success: true, data: { received: true } });
  });

  router.post('/orders', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const input = createPaymentOrderSchema.parse(req.body);
    const found = await db.query<PaymentRow>(
      'SELECT * FROM payments WHERE booking_id=$1 ORDER BY created_at DESC LIMIT 1',
      [input.bookingId],
    );
    const payment = found.rows[0];
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payable booking was found', code: 'PAYMENT_NOT_FOUND' });
    }
    const staff = auth.roles.has('ADMIN') || auth.roles.has('STAFF');
    if (!staff && payment.user_id !== auth.subject) {
      return res.status(403).json({ success: false, message: 'You can only pay for your own booking', code: 'PAYMENT_FORBIDDEN' });
    }
    if (payment.status !== 'PENDING') {
      return res.status(409).json({
        success: false,
        message: `This payment is already ${payment.status.toLowerCase()}`,
        code: 'PAYMENT_NOT_PENDING',
        data: publicPayment(payment),
      });
    }
    if (payment.razorpay_order_id) {
      const captured = await options.gateway.findCapturedPayment?.(payment.razorpay_order_id);
      if (captured) {
        await finalizePayment(db, payment.id, 'COMPLETED', captured.paymentId);
        return res.json({
          success: true,
          data: checkoutPayload(payment, options, {
            orderId: payment.razorpay_order_id,
            provider: payment.provider,
            alreadyPaid: true,
          }),
        });
      }
      return res.json({
        success: true,
        data: checkoutPayload(payment, options, {
          orderId: payment.razorpay_order_id,
          provider: payment.provider,
        }),
      });
    }
    try {
      const session = await options.gateway.createOrder({
        amountCents: payment.amount_cents,
        currency: payment.currency,
        receipt: payment.booking_id,
        notes: { bookingId: payment.booking_id },
      });
      await db.query(
        `UPDATE payments SET razorpay_order_id=$2, provider=$3 WHERE id=$1 AND razorpay_order_id IS NULL`,
        [payment.id, session.orderId, session.provider],
      );
      return res.status(201).json({
        success: true,
        data: checkoutPayload(payment, options, {
          orderId: session.orderId,
          provider: session.provider,
        }),
      });
    } catch (error) {
      return res.status(502).json({
        success: false,
        message: error instanceof Error ? error.message : 'Payment provider unavailable',
        code: 'PROVIDER_UNAVAILABLE',
      });
    }
  });

  router.post('/orders/:bookingId/simulate', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const input = simulatePaymentSchema.parse(req.body ?? {});
    const found = await db.query<PaymentRow>(
      'SELECT * FROM payments WHERE booking_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.bookingId],
    );
    const payment = found.rows[0];
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payable booking was found', code: 'PAYMENT_NOT_FOUND' });
    }
    const staff = auth.roles.has('ADMIN') || auth.roles.has('STAFF');
    if (!staff && payment.user_id !== auth.subject) {
      return res.status(403).json({ success: false, message: 'You can only pay for your own booking', code: 'PAYMENT_FORBIDDEN' });
    }
    const provider = new SimulatedPaymentProvider();
    const outcome = provider.charge(input.outcome);
    const finalized = await finalizePayment(
      db,
      payment.id,
      outcome.succeeded ? 'COMPLETED' : 'FAILED',
      outcome.reference,
    );
    if (!finalized) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
    }
    return res.json({ success: true, data: publicPayment(finalized) });
  });

  router.post('/orders/:bookingId/confirm', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const input = confirmRazorpayPaymentSchema.parse(req.body ?? {});
    const secret = options.keySecret;
    if (!secret) {
      return res.status(503).json({ success: false, message: 'Razorpay key secret is not configured', code: 'CONFIRM_UNAVAILABLE' });
    }
    const found = await db.query<PaymentRow>(
      'SELECT * FROM payments WHERE booking_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.bookingId],
    );
    const payment = found.rows[0];
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payable booking was found', code: 'PAYMENT_NOT_FOUND' });
    }
    const staff = auth.roles.has('ADMIN') || auth.roles.has('STAFF');
    if (!staff && payment.user_id !== auth.subject) {
      return res.status(403).json({ success: false, message: 'You can only pay for your own booking', code: 'PAYMENT_FORBIDDEN' });
    }
    if (payment.razorpay_order_id && payment.razorpay_order_id !== input.orderId) {
      return res.status(409).json({ success: false, message: 'Checkout order does not match this booking', code: 'ORDER_MISMATCH' });
    }
    if (!signaturesMatch(`${input.orderId}|${input.paymentId}`, input.signature, secret)) {
      return res.status(401).json({ success: false, message: 'Invalid checkout signature', code: 'INVALID_CHECKOUT_SIGNATURE' });
    }
    const finalized = await finalizePayment(db, payment.id, 'COMPLETED', input.paymentId);
    if (!finalized) {
      return res.status(404).json({ success: false, message: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
    }
    return res.json({ success: true, data: publicPayment(finalized) });
  });

  router.get('/payments/by-booking/:bookingId', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const found = await db.query<PaymentRow>(
      'SELECT * FROM payments WHERE booking_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.bookingId],
    );
    const row = found.rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Payment not found' });
    const staff = auth.roles.has('ADMIN') || auth.roles.has('STAFF');
    if (!staff && row.user_id !== auth.subject) {
      return res.status(403).json({ success: false, message: 'Payment not found', code: 'PAYMENT_FORBIDDEN' });
    }
    return res.json({ success: true, data: publicPayment(row) });
  });

  router.get('/payments/:id', requireAnyRole('ADMIN', 'STAFF'), async (req, res) => {
    const row = (await db.query<PaymentRow>('SELECT * FROM payments WHERE id=$1', [req.params.id])).rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Payment not found' });
    return res.json({ success: true, data: publicPayment(row) });
  });
  return router;
}
