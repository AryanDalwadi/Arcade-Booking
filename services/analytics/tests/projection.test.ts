import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eventTypes } from '@arcade/contracts';
import { applyInventoryReserved } from '../src/projection/apply';
import { accessPatterns, machineDayKeys, venueDayKeys } from '../src/projection/keys';
import { MemoryProjectionStore } from '../src/projection/memory-store';

function reserved(overrides: {
  bookingId?: string;
  machineId?: string;
  startAt?: string;
  durationMinutes?: number;
  occurredAt?: string;
} = {}) {
  const bookingId = overrides.bookingId ?? randomUUID();
  const machineId = overrides.machineId ?? randomUUID();
  return {
    eventId: randomUUID(),
    eventType: eventTypes.inventoryReserved,
    version: 1 as const,
    occurredAt: overrides.occurredAt ?? '2026-09-22T10:00:00.000Z',
    correlationId: randomUUID(),
    producer: 'inventory',
    payload: {
      bookingId,
      machineId,
      startAt: overrides.startAt ?? '2026-09-22T12:00:00.000Z',
      durationMinutes: overrides.durationMinutes ?? 60,
      amountCents: 1500,
      currency: 'USD',
    },
  };
}

describe('dynamo-shaped utilization projection', () => {
  it('defines two GetItem access patterns and no speculative GSI', () => {
    expect(accessPatterns).toHaveLength(2);
    expect(accessPatterns.every((pattern) => pattern.operation === 'GetItem' && pattern.gsi === false)).toBe(true);
    expect(venueDayKeys('arcade', '2026-09-22')).toEqual({ pk: 'VENUE#arcade', sk: 'DAY#2026-09-22' });
    expect(machineDayKeys('m1', '2026-09-22')).toEqual({ pk: 'MACHINE#m1', sk: 'DAY#2026-09-22' });
  });

  it('adds reserved minutes once for a booking', () => {
    const store = new MemoryProjectionStore();
    const event = reserved({ durationMinutes: 90 });
    expect(applyInventoryReserved(store, event, 'arcade').applied).toBe(true);
    expect(store.venueDay('arcade', '2026-09-22')?.minutes).toBe(90);
    expect(store.machineDay(event.payload.machineId, '2026-09-22')?.bookingCount).toBe(1);
  });

  it('ignores a duplicate booking id (retry / at-least-once Kafka)', () => {
    const store = new MemoryProjectionStore();
    const bookingId = randomUUID();
    const machineId = randomUUID();
    applyInventoryReserved(store, reserved({ bookingId, machineId, durationMinutes: 60 }), 'arcade');
    applyInventoryReserved(store, reserved({ bookingId, machineId, durationMinutes: 60 }), 'arcade');
    expect(store.venueDay('arcade', '2026-09-22')?.minutes).toBe(60);
    expect(store.venueDay('arcade', '2026-09-22')?.bookingCount).toBe(1);
  });

  it('still counts an out-of-order later booking with an older occurredAt', () => {
    const store = new MemoryProjectionStore();
    const machineId = randomUUID();
    applyInventoryReserved(store, reserved({
      machineId,
      durationMinutes: 30,
      occurredAt: '2026-09-22T12:00:00.000Z',
    }), 'arcade');
    applyInventoryReserved(store, reserved({
      machineId,
      durationMinutes: 45,
      occurredAt: '2026-09-22T09:00:00.000Z',
    }), 'arcade');
    const venue = store.venueDay('arcade', '2026-09-22');
    expect(venue?.minutes).toBe(75);
    expect(venue?.bookingCount).toBe(2);
    expect(venue?.lastOccurredAt).toBe('2026-09-22T12:00:00.000Z');
  });
});
