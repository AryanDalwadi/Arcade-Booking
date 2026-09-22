import { machineDayKeys, utcDay, venueDayKeys, type UtilizationItem } from './keys';

export class MemoryProjectionStore {
  private readonly items = new Map<string, UtilizationItem>();

  private id(pk: string, sk: string) {
    return `${pk}\0${sk}`;
  }

  get(pk: string, sk: string): UtilizationItem | undefined {
    return this.items.get(this.id(pk, sk));
  }

  reset() {
    this.items.clear();
  }

  /** Conditional write: skip if this bookingId was already applied (duplicate Kafka delivery). */
  applyReservation(input: {
    venueId: string;
    machineId: string;
    bookingId: string;
    startAt: string;
    durationMinutes: number;
    occurredAt: string;
  }): { applied: boolean } {
    const day = utcDay(input.startAt);
    const now = new Date().toISOString();
    const targets = [venueDayKeys(input.venueId, day), machineDayKeys(input.machineId, day)];
    let applied = false;
    for (const { pk, sk } of targets) {
      const current = this.get(pk, sk);
      if (current?.appliedBookingIds.includes(input.bookingId)) continue;
      const next: UtilizationItem = {
        pk,
        sk,
        minutes: (current?.minutes ?? 0) + input.durationMinutes,
        bookingCount: (current?.bookingCount ?? 0) + 1,
        appliedBookingIds: [...(current?.appliedBookingIds ?? []), input.bookingId],
        lastOccurredAt: !current || input.occurredAt > current.lastOccurredAt
          ? input.occurredAt
          : current.lastOccurredAt,
        updatedAt: now,
      };
      this.items.set(this.id(pk, sk), next);
      applied = true;
    }
    return { applied };
  }

  venueDay(venueId: string, day: string) {
    return this.get(venueDayKeys(venueId, day).pk, venueDayKeys(venueId, day).sk);
  }

  machineDay(machineId: string, day: string) {
    return this.get(machineDayKeys(machineId, day).pk, machineDayKeys(machineId, day).sk);
  }

  machinesForDay(day: string): UtilizationItem[] {
    return [...this.items.values()].filter((item) => item.pk.startsWith('MACHINE#') && item.sk === `DAY#${day}`);
  }
}
