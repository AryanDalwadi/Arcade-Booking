import { eventEnvelopeSchema, eventTypes, inventoryEventPayloadSchema } from '@arcade/contracts';
import type { MemoryProjectionStore } from './memory-store';

export function applyInventoryReserved(
  store: MemoryProjectionStore,
  event: unknown,
  venueId: string,
): { applied: boolean } {
  const envelope = eventEnvelopeSchema.parse(event);
  if (envelope.eventType !== eventTypes.inventoryReserved) return { applied: false };
  const payload = inventoryEventPayloadSchema.parse(envelope.payload);
  return store.applyReservation({
    venueId,
    machineId: payload.machineId,
    bookingId: payload.bookingId,
    startAt: payload.startAt,
    durationMinutes: payload.durationMinutes,
    occurredAt: envelope.occurredAt,
  });
}
