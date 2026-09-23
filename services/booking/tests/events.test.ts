import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { eventTypes } from '@arcade/contracts';
import { Postgres } from '../src/adapters/postgres';
import { handleBookingEvent } from '../src/application/context';

describe('booking payment and inventory events', () => {
  it('marks an unpaid booking payment failed when inventory releases the slot', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    await handleBookingEvent({ query } as unknown as Postgres, {
      eventId: randomUUID(),
      eventType: eventTypes.inventoryReleased,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      producer: 'inventory',
      payload: {
        bookingId: '30000000-0000-4000-8000-000000000001',
        machineId: randomUUID(),
        startAt: new Date().toISOString(),
        durationMinutes: 60,
        reason: 'Unpaid reservation hold expired',
      },
    });
    expect(String(query.mock.calls[0]?.[0])).toContain("inventory_status='RELEASED'");
    expect(String(query.mock.calls[0]?.[0])).toContain('PAYMENT_FAILED');
  });

  it('does not confirm a late payment after the booking already failed', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    await handleBookingEvent({ query } as unknown as Postgres, {
      eventId: randomUUID(),
      eventType: eventTypes.paymentCompleted,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      producer: 'payment',
      payload: {
        id: randomUUID(),
        bookingId: '30000000-0000-4000-8000-000000000001',
        amountCents: 6000,
        currency: 'INR',
        status: 'COMPLETED',
      },
    });
    expect(String(query.mock.calls[0]?.[0])).toContain("status IN ('PAYMENT_FAILED', 'CANCELLED')");
  });
});
