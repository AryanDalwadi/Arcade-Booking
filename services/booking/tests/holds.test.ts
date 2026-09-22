import { describe, expect, it } from 'vitest';
import { bookingHoldKeys } from '../src/application/holds';

const machineId = '0d172145-72b5-4cb9-afe6-4eef3801764d';

describe('booking hold slots', () => {
  it('makes overlapping 60- and 90-minute bookings share Redis keys', () => {
    const first = bookingHoldKeys(machineId, '2026-09-22T11:15:00.000Z', 90);
    const second = bookingHoldKeys(machineId, '2026-09-22T11:15:00.000Z', 60);
    const overlapLater = bookingHoldKeys(machineId, '2026-09-22T11:45:00.000Z', 60);

    expect(first).toEqual([
      `booking:hold:${machineId}:2026-09-22T11:15:00.000Z`,
      `booking:hold:${machineId}:2026-09-22T11:30:00.000Z`,
      `booking:hold:${machineId}:2026-09-22T11:45:00.000Z`,
      `booking:hold:${machineId}:2026-09-22T12:00:00.000Z`,
      `booking:hold:${machineId}:2026-09-22T12:15:00.000Z`,
      `booking:hold:${machineId}:2026-09-22T12:30:00.000Z`,
    ]);
    expect(second.every((key) => first.includes(key))).toBe(true);
    expect(overlapLater.some((key) => first.includes(key))).toBe(true);
  });

  it('does not collide with a booking that starts when the first range ends', () => {
    const first = bookingHoldKeys(machineId, '2026-09-22T11:15:00.000Z', 90);
    const next = bookingHoldKeys(machineId, '2026-09-22T12:45:00.000Z', 60);
    expect(next.some((key) => first.includes(key))).toBe(false);
  });
});
