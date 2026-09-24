import { slotAvailabilitySchema } from '@arcade/contracts';

export interface SlotAvailability {
  available(machineId: string, startAt: string, durationMinutes: number): Promise<boolean>;
}

export class InventoryClient implements SlotAvailability {
  constructor(private readonly baseUrl: string) {}

  async available(machineId: string, startAt: string, durationMinutes: number): Promise<boolean> {
    const url = new URL('/v1/availability', this.baseUrl);
    url.searchParams.set('machineId', machineId);
    url.searchParams.set('startAt', startAt);
    url.searchParams.set('durationMinutes', String(durationMinutes));
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    const body = await response.json().catch(() => null) as { success?: boolean; data?: unknown } | null;
    if (!response.ok || !body?.success) {
      throw new Error(`Inventory could not check slot availability (${response.status})`);
    }
    return slotAvailabilitySchema.parse(body.data).available;
  }
}
