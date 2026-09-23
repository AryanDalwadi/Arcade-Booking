import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { eventTypes } from '@arcade/contracts';
import { Postgres } from '../src/adapters/postgres';
import { expireUnpaidHolds, handleEvent, releaseReservation } from '../src/application/context';

const bookingId = '30000000-0000-4000-8000-000000000001';

describe('unpaid reservation holds', () => {
  it('releases an uncommitted reserved slot and writes inventory.released', async () => {
    const outbox: unknown[] = [];
    const db = {
      transaction: async (work: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => work({
        query: vi.fn(async (sql: string, values?: unknown[]) => {
          if (sql.includes("status='RESERVED' AND committed=false")) {
            return {
              rows: [{
                booking_id: bookingId,
                machine_id: randomUUID(),
                start_at: new Date().toISOString(),
                duration_minutes: 60,
                status: 'RELEASED',
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('INSERT INTO outbox')) {
            outbox.push(values?.[2]);
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      }),
    } as unknown as Postgres;
    expect(await releaseReservation(db, bookingId, 'Payment failed or unpaid hold expired')).toBe(true);
    expect((outbox[0] as { eventType: string }).eventType).toBe(eventTypes.inventoryReleased);
  });

  it('expires stale unpaid holds', async () => {
    const released: string[] = [];
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('hold_expires_at < now()')) {
          return { rows: [{ booking_id: bookingId, machine_id: randomUUID(), start_at: new Date(), duration_minutes: 60, status: 'RESERVED' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      transaction: async (work: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => work({
        query: vi.fn(async (sql: string, values?: unknown[]) => {
          if (sql.includes('UPDATE reservations')) {
            released.push(String(values?.[0]));
            return {
              rows: [{
                booking_id: bookingId,
                machine_id: randomUUID(),
                start_at: new Date().toISOString(),
                duration_minutes: 60,
                status: 'RELEASED',
              }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      }),
    } as unknown as Postgres;
    expect(await expireUnpaidHolds(db)).toBe(1);
    expect(released).toEqual([bookingId]);
  });

  it('commits a reserved slot when payment completes', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    await handleEvent({ query } as unknown as Postgres, {
      eventId: randomUUID(),
      eventType: eventTypes.paymentCompleted,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      producer: 'payment',
      payload: {
        id: randomUUID(),
        bookingId,
        amountCents: 6000,
        currency: 'INR',
        status: 'COMPLETED',
      },
    });
    expect(String(query.mock.calls[0]?.[0])).toContain('committed=true');
  });
});
