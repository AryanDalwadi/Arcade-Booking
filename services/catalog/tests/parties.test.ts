import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Postgres } from '../src/adapters/postgres';
import { RedisAdapter } from '../src/adapters/redis';
import { catalogRoutes } from '../src/application/context';
import { createHttpApp } from '../src/http/app';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))));
});

const partyTypeId = 'b1000000-0000-4000-8000-000000000001';
const staffHeaders = {
  'content-type': 'application/json',
  'x-auth-subject': '10000000-0000-4000-8000-000000000001',
  'x-auth-roles': 'STAFF',
};

async function serve(query: ReturnType<typeof vi.fn>) {
  const db = {
    query,
    transaction: async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }),
  } as unknown as Postgres;
  const redis = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    isReady: () => true,
  } as unknown as RedisAdapter;
  const app = createHttpApp({
    dbReady: async () => true,
    dependencyReady: () => true,
    routes: catalogRoutes(db, redis),
  });
  const server = createServer(app).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('party venue masters', () => {
  it('refuses customer changes to venues', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const origin = await serve(query);
    const response = await fetch(`${origin}/v1/venues`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
        'x-auth-roles': 'CUSTOMER',
      },
      body: JSON.stringify({
        name: 'Ambience Mall',
        slug: 'timezone-ambiencemallgurgaon',
        partyTypeIds: [partyTypeId],
      }),
    });
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('copies Lite, Classic, and Premium when a venue is created', async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      const text = String(sql);
      calls.push(text);
      if (text.includes('count(*)') && text.includes('package_templates')) {
        return { rows: [{ count: 1 }], rowCount: 1 };
      }
      if (text.includes('count(*)') && text.includes('party_types')) {
        return { rows: [{ count: 1 }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO venues')) {
        return {
          rows: [{
            id: 'd1000000-0000-4000-8000-000000000001',
            name: 'Ambience Mall Gurgaon',
            slug: 'timezone-ambiencemallgurgaon',
            city: 'Gurgaon',
            mall: 'Ambience',
            address: '',
            phone: '',
            email: '',
            description: '',
            timezone: 'Asia/Kolkata',
            active: true,
            createdAt: '2026-11-24T10:00:00.000Z',
            partyTypeIds: [partyTypeId],
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const origin = await serve(query);
    const response = await fetch(`${origin}/v1/venues`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        name: 'Ambience Mall Gurgaon',
        slug: 'timezone-ambiencemallgurgaon',
        city: 'Gurgaon',
        mall: 'Ambience',
        partyTypeIds: [partyTypeId],
        packageCodes: ['LITE'],
      }),
    });
    expect(response.status).toBe(201);
    expect(calls.some((sql) => sql.includes('INSERT INTO venue_packages') && sql.includes('FROM package_templates'))).toBe(true);
    expect(calls.some((sql) => sql.includes('INSERT INTO venue_package_inclusions'))).toBe(true);
    expect(calls.some((sql) => sql.includes('INSERT INTO venue_hours'))).toBe(true);
    const body = await response.json() as { data: { name: string; partyTypeIds: string[] } };
    expect(body.data.name).toBe('Ambience Mall Gurgaon');
    expect(body.data.partyTypeIds).toEqual([partyTypeId]);
  });

  it('does not offer a way to add a fourth package', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const origin = await serve(query);
    const response = await fetch(`${origin}/v1/venues/d1000000-0000-4000-8000-000000000001/packages`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ code: 'DELUXE' }),
    });
    expect(response.status).toBe(404);
  });

  it('updates an existing venue package in place', async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      const text = String(sql);
      calls.push(text);
      if (text.includes('count(*)') && text.includes('inclusions')) {
        return { rows: [{ count: 1 }], rowCount: 1 };
      }
      if (text.includes('UPDATE venue_packages')) {
        return {
          rows: [{
            id: 'e1000000-0000-4000-8000-000000000001',
            venueId: 'd1000000-0000-4000-8000-000000000001',
            code: 'LITE',
            name: 'Lite',
            description: 'Updated lite',
            pricePerPersonCents: 55000,
            currency: 'INR',
            minGuests: 10,
            maxGuests: 40,
            durationMinutes: 60,
            sortOrder: 1,
            active: true,
            inclusionIds: ['c1000000-0000-4000-8000-000000000001'],
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const origin = await serve(query);
    const response = await fetch(`${origin}/v1/venues/d1000000-0000-4000-8000-000000000001/packages/LITE`, {
      method: 'PATCH',
      headers: staffHeaders,
      body: JSON.stringify({
        description: 'Updated lite',
        pricePerPersonCents: 55000,
        currency: 'INR',
        minGuests: 10,
        maxGuests: 40,
        durationMinutes: 60,
        active: true,
        inclusionIds: ['c1000000-0000-4000-8000-000000000001'],
      }),
    });
    expect(response.status).toBe(200);
    expect(calls.some((sql) => sql.includes('UPDATE venue_packages'))).toBe(true);
    expect(calls.some((sql) => sql.includes('INSERT INTO venue_packages'))).toBe(false);
    const body = await response.json() as { data: { name: string; pricePerPersonCents: number } };
    expect(body.data.name).toBe('Lite');
    expect(body.data.pricePerPersonCents).toBe(55000);
  });
});
