import {
  machineQuoteSchema,
  type ApiSuccess,
  type MachineQuote,
} from '@arcade/contracts';

export interface QuoteProvider {
  quote(machineId: string, durationMinutes: number): Promise<MachineQuote>;
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
}
