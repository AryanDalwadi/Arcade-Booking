/** Fifteen-minute buckets so 60- and 90-minute bookings on the same machine collide. */
export const HOLD_SLOT_MINUTES = 15;
export const HOLD_TTL_SECONDS = 120;

export function bookingHoldKeys(
  machineId: string,
  startAt: string,
  durationMinutes: number,
): string[] {
  const startMs = Date.parse(startAt);
  if (!Number.isFinite(startMs) || durationMinutes <= 0) {
    return [`booking:hold:${machineId}:${startAt}`];
  }
  const endMs = startMs + durationMinutes * 60_000;
  const slotMs = HOLD_SLOT_MINUTES * 60_000;
  const first = Math.floor(startMs / slotMs) * slotMs;
  const lastExclusive = Math.ceil(endMs / slotMs) * slotMs;
  const keys: string[] = [];
  for (let slot = first; slot < lastExclusive; slot += slotMs) {
    keys.push(`booking:hold:${machineId}:${new Date(slot).toISOString()}`);
  }
  return keys;
}
