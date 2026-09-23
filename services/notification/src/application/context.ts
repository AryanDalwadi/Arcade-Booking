import { Router } from 'express';
import {
  bookingCreatedEventSchema,
  eventEnvelopeSchema,
  eventTypes,
  inventoryRejectedEventSchema,
  paymentCompletedEventSchema,
  paymentFailedEventSchema,
} from '@arcade/contracts';
import { requireAnyRole } from '@arcade/service-auth';
import type { Mailer, MailMessage } from '../adapters/mail';
import { Postgres } from '../adapters/postgres';

function templateFor(event: unknown): MailMessage | null {
  const envelope = eventEnvelopeSchema.safeParse(event);
  if (!envelope.success) return null;
  const type = envelope.data.eventType;
  if (type === eventTypes.bookingCreated) {
    const parsed = bookingCreatedEventSchema.parse(event);
    const email = parsed.payload.customerEmail;
    if (!email) return null;
    return {
      to: email,
      subject: 'Arcade booking received — pay to confirm',
      text: `We received booking ${parsed.payload.id} for ${parsed.payload.durationMinutes} minutes. Complete Razorpay test checkout to confirm the reservation.`,
    };
  }
  if (type === eventTypes.paymentCompleted) {
    const parsed = paymentCompletedEventSchema.parse(event);
    const email = parsed.payload.customerEmail;
    if (!email) return null;
    return {
      to: email,
      subject: 'Arcade booking confirmed',
      text: `Payment for booking ${parsed.payload.bookingId} completed. Your session is confirmed.`,
    };
  }
  if (type === eventTypes.paymentFailed) {
    const parsed = paymentFailedEventSchema.parse(event);
    const email = parsed.payload.customerEmail;
    if (!email) return null;
    return {
      to: email,
      subject: 'Arcade payment failed',
      text: `Payment for booking ${parsed.payload.bookingId} failed. You can retry checkout from My Bookings.`,
    };
  }
  if (type === eventTypes.inventoryRejected) {
    const parsed = inventoryRejectedEventSchema.parse(event);
    const email = parsed.payload.customerEmail;
    if (!email) return null;
    return {
      to: email,
      subject: 'Arcade slot unavailable',
      text: `Booking ${parsed.payload.bookingId} could not be reserved. ${parsed.payload.reason ?? 'The machine is already booked for that time.'}`,
    };
  }
  return null;
}

export async function handleEvent(db: Postgres, event: unknown, mailer: Mailer): Promise<void> {
  const parsed = eventEnvelopeSchema.parse(event);
  const message = templateFor(event);
  const recipient = message?.to ?? 'unknown';
  const inserted = await db.query(
    `INSERT INTO deliveries(event_id,event_type,channel,recipient,status,payload)
     VALUES($1,$2,'EMAIL',$3,'RECORDED',$4) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,
    [parsed.eventId, parsed.eventType, recipient, parsed.payload],
  );
  if (!inserted.rowCount) return;
  if (!message) return;
  try {
    await mailer.send(message);
    await db.query(`UPDATE deliveries SET status='SENT' WHERE event_id=$1`, [parsed.eventId]);
  } catch {
    await db.query(`UPDATE deliveries SET status='FAILED' WHERE event_id=$1`, [parsed.eventId]);
  }
}

export function notificationRoutes(db: Postgres): Router {
  const router = Router();
  router.get('/deliveries', requireAnyRole('ADMIN', 'STAFF'), async (_req, res) => {
    res.json({
      success: true,
      data: (await db.query(`SELECT * FROM deliveries ORDER BY created_at DESC LIMIT 100`)).rows,
    });
  });
  return router;
}
