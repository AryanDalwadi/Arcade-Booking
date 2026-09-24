import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MachineQuote } from '@arcade/contracts';
import type { QuoteProvider } from '../src/adapters/catalog';
import { Postgres } from '../src/adapters/postgres';
import { RedisAdapter } from '../src/adapters/redis';
import { bookingRoutes } from '../src/application/context';
import { createHttpApp } from '../src/http/app';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))));
});

async function serve(
  db: Postgres,
  redis: RedisAdapter,
  quotes: QuoteProvider,
  inventory = { available: vi.fn(async () => true) },
): Promise<string> {
  const app = createHttpApp({
    dbReady: async () => true,
    dependencyReady: () => true,
    routes: bookingRoutes(db, redis, quotes, inventory),
  });
  const server = createServer(app).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function quote(): MachineQuote {
  return {
    machineId: '20000000-0000-4000-8000-000000000001',
    durationMinutes: 60,
    amountCents: 24000,
    currency: 'INR',
  };
}

describe('booking ownership and pricing', () => {
  it('requires verified gateway identity context', async () => {
    const db = {} as Postgres;
    const redis = {} as RedisAdapter;
    const quotes = { quote: vi.fn() };
    const origin = await serve(db, redis, quotes);
    const response = await fetch(`${origin}/v1/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        machineId: quote().machineId,
        startAt: '2026-10-01T10:00:00.000Z',
        durationMinutes: 60,
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'AUTH_CONTEXT_REQUIRED' });
  });

  it('uses the verified subject and server-side Catalog quote', async () => {
    let insertValues: unknown[] = [];
    const client = {
      query: vi.fn(async (sql: string, values: unknown[]) => {
        if (sql.includes('INSERT INTO bookings')) {
          insertValues = values;
          return {
            rows: [{
              id: '30000000-0000-4000-8000-000000000001',
              user_id: values[0],
              machine_id: values[1],
              start_at: values[2],
              duration_minutes: values[3],
              amount_cents: values[4],
              currency: values[5],
              status: 'PENDING_PAYMENT',
              created_at: new Date('2026-10-01T09:00:00.000Z'),
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const db = {
      transaction: async (work: (value: typeof client) => Promise<unknown>) => work(client),
    } as unknown as Postgres;
    const redis = {
      acquire: vi.fn(async () => true),
      delete: vi.fn(async () => undefined),
    } as unknown as RedisAdapter;
    const quotes = { quote: vi.fn(async () => quote()) };
    const origin = await serve(db, redis, quotes);
    const response = await fetch(`${origin}/v1/bookings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
      },
      body: JSON.stringify({
        userId: '90000000-0000-4000-8000-000000000009',
        machineId: quote().machineId,
        startAt: '2026-10-01T10:00:00.000Z',
        durationMinutes: 60,
        amountCents: 1,
        currency: 'USD',
      }),
    });

    expect(response.status).toBe(201);
    expect(insertValues).toEqual([
      '10000000-0000-4000-8000-000000000001',
      quote().machineId,
      '2026-10-01T10:00:00.000Z',
      60,
      24000,
      'INR',
    ]);
  });

  it('scopes customers to themselves and lets staff read all bookings', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const db = { query } as unknown as Postgres;
    const origin = await serve(db, {} as RedisAdapter, { quote: vi.fn() });

    const customerResponse = await fetch(`${origin}/v1/bookings?userId=attacker`, {
      headers: {
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
        'x-auth-roles': 'CUSTOMER',
      },
    });
    expect(customerResponse.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual(['10000000-0000-4000-8000-000000000001']);

    const staffResponse = await fetch(`${origin}/v1/bookings`, {
      headers: {
        'x-auth-subject': '20000000-0000-4000-8000-000000000002',
        'x-auth-roles': 'STAFF',
      },
    });
    expect(staffResponse.status).toBe(200);
    expect(query.mock.calls[1]?.[1]).toEqual([]);
  });

  it('rejects a second overlapping hold with 409', async () => {
    const redis = {
      acquire: vi.fn(async () => false),
      delete: vi.fn(async () => undefined),
    } as unknown as RedisAdapter;
    const origin = await serve({} as Postgres, redis, { quote: vi.fn(async () => quote()) });
    const response = await fetch(`${origin}/v1/bookings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
      },
      body: JSON.stringify({
        machineId: quote().machineId,
        startAt: '2026-10-01T10:00:00.000Z',
        durationMinutes: 90,
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'BOOKING_HOLD_EXISTS' });
  });

  it('rejects a slot inventory already reserved', async () => {
    const inventory = { available: vi.fn(async () => false) };
    const origin = await serve({} as Postgres, {} as RedisAdapter, { quote: vi.fn(async () => quote()) }, inventory);
    const response = await fetch(`${origin}/v1/bookings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
      },
      body: JSON.stringify({
        machineId: quote().machineId,
        startAt: '2026-10-01T10:00:00.000Z',
        durationMinutes: 60,
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'BOOKING_SLOT_UNAVAILABLE',
      message: 'This machine is already booked for that time',
    });
  });
});
