import { z } from 'zod';
import {
  machineQuoteSchema,
  partyRoomSchema,
  bookingRulesSchema,
  venueBlackoutSchema,
  venueHourSchema,
  venuePackageSchema,
  venueSchema,
  type ApiSuccess,
  type BookingRules,
  type MachineQuote,
  type PartyRoom,
  type Venue,
  type VenueBlackout,
  type VenueHour,
  type VenuePackage,
} from '@arcade/contracts';

export interface QuoteProvider {
  quote(machineId: string, durationMinutes: number): Promise<MachineQuote>;
}

export interface PartyCatalog {
  venue(venueId: string): Promise<Venue>;
  packages(venueId: string): Promise<VenuePackage[]>;
  hours(venueId: string): Promise<VenueHour[]>;
  blackouts(venueId: string): Promise<VenueBlackout[]>;
  rooms(venueId: string): Promise<PartyRoom[]>;
  rules(): Promise<BookingRules>;
}

export class CatalogClient implements QuoteProvider {
  constructor(private readonly baseUrl: string) {}

  async quote(machineId: string, durationMinutes: number): Promise<MachineQuote> {
    const url = new URL(`/v1/machines/${encodeURIComponent(machineId)}/quote`, this.baseUrl);
    url.searchParams.set('durationMinutes', String(durationMinutes));
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    const body = await response.json().catch(() => null) as ApiSuccess<unknown> | null;
    if (!response.ok || !body?.success) {
      throw new Error(`Catalog could not quote machine ${machineId} (${response.status})`);
    }
    return machineQuoteSchema.parse(body.data);
  }

  venue(venueId: string) {
    return this.read(`/v1/venues/${encodeURIComponent(venueId)}`, venueSchema);
  }

  packages(venueId: string) {
    return this.read(`/v1/venues/${encodeURIComponent(venueId)}/packages`, z.array(venuePackageSchema));
  }

  hours(venueId: string) {
    return this.read(`/v1/venues/${encodeURIComponent(venueId)}/hours`, z.array(venueHourSchema));
  }

  blackouts(venueId: string) {
    return this.read(`/v1/venues/${encodeURIComponent(venueId)}/blackouts`, z.array(venueBlackoutSchema));
  }

  rooms(venueId: string) {
    return this.read(`/v1/venues/${encodeURIComponent(venueId)}/rooms`, z.array(partyRoomSchema));
  }

  rules() {
    return this.read('/v1/booking-rules', bookingRulesSchema);
  }

  private async read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), { signal: AbortSignal.timeout(3_000) });
    const body = await response.json().catch(() => null) as ApiSuccess<unknown> | null;
    if (!response.ok || !body?.success) {
      throw new Error(`Catalog request failed (${response.status})`);
    }
    return schema.parse(body.data);
  }
}
