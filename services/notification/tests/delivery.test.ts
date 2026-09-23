import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { RecordingMailer } from '../src/adapters/mail';
import { handleEvent } from '../src/application/context';
import { Postgres } from '../src/adapters/postgres';

const event = {
  eventId: randomUUID(),
  eventType: 'arcade.payment.completed.v1' as const,
  version: 1 as const,
  occurredAt: new Date().toISOString(),
  correlationId: randomUUID(),
  producer: 'payment',
  payload: {
    id: randomUUID(),
    bookingId: randomUUID(),
    amountCents: 6000,
    currency: 'INR',
    status: 'COMPLETED' as const,
    customerEmail: 'player@example.com',
  },
};

describe('notification delivery', () => {
  it('sends once for a new event and skips a duplicate event id', async () => {
    const mailer = new RecordingMailer();
    let inserted = false;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO deliveries')) {
        if (inserted) return { rows: [], rowCount: 0 };
        inserted = true;
        return { rows: [{ event_id: event.eventId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const db = { query } as unknown as Postgres;
    await handleEvent(db, event, mailer);
    await handleEvent(db, event, mailer);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe('player@example.com');
    expect(mailer.sent[0]?.subject).toMatch(/confirmed/i);
  });
});
