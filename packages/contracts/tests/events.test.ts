import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  bookingCreatedEventSchema,
  eventTypes,
} from '../src';

describe('versioned event contracts', () => {
  it('rejects a booking event with the wrong version', () => {
    const result = bookingCreatedEventSchema.safeParse({
      eventId: randomUUID(),
      eventType: eventTypes.bookingCreated,
      version: 2,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      producer: 'booking',
      payload: {
        id: randomUUID(),
        userId: randomUUID(),
        machineId: randomUUID(),
        startAt: new Date().toISOString(),
        durationMinutes: 60,
        amountCents: 1200,
        currency: 'USD',
      },
    });

    expect(result.success).toBe(false);
  });
});
