/** Named access patterns come first. Keys follow the queries, not the other way. */

export const DEFAULT_VENUE_ID = 'arcade';

export const accessPatterns = [
  {
    name: 'utilizationByVenueDay',
    query: 'How many reserved minutes did venue V book on day D?',
    pk: 'VENUE#{venueId}',
    sk: 'DAY#{yyyy-mm-dd}',
    operation: 'GetItem',
    gsi: false,
  },
  {
    name: 'utilizationByMachineDay',
    query: 'How many reserved minutes did machine M book on day D?',
    pk: 'MACHINE#{machineId}',
    sk: 'DAY#{yyyy-mm-dd}',
    operation: 'GetItem',
    gsi: false,
  },
] as const;

export function venueDayKeys(venueId: string, day: string) {
  return { pk: `VENUE#${venueId}`, sk: `DAY#${day}` };
}

export function machineDayKeys(machineId: string, day: string) {
  return { pk: `MACHINE#${machineId}`, sk: `DAY#${day}` };
}

export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

export interface UtilizationItem {
  pk: string;
  sk: string;
  minutes: number;
  bookingCount: number;
  appliedBookingIds: string[];
  lastOccurredAt: string;
  updatedAt: string;
}
