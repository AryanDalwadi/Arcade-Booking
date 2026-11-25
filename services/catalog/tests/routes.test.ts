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

async function serve(
  query: ReturnType<typeof vi.fn>,
  redisOverrides: Partial<RedisAdapter> = {},
): Promise<{ origin: string; redis: RedisAdapter }> {
  const db = {
    query,
    transaction: async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }),
  } as unknown as Postgres;
  const redis = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    isReady: () => true,
    ...redisOverrides,
  } as unknown as RedisAdapter;
  const app = createHttpApp({
    dbReady: async () => true,
    dependencyReady: () => true,
    routes: catalogRoutes(db, redis),
  });
  const server = createServer(app).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, redis };
}

describe('catalog authorization', () => {
  it('allows authenticated customers to browse but denies mutations', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const { origin } = await serve(query);
    const headers = {
      'content-type': 'application/json',
      'x-auth-subject': '10000000-0000-4000-8000-000000000001',
      'x-auth-roles': 'CUSTOMER',
    };
    expect((await fetch(`${origin}/v1/machines`, { headers })).status).toBe(200);
    expect((await fetch(`${origin}/v1/machines`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Racer', status: 'ACTIVE' }),
    })).status).toBe(403);
  });

  it('allows staff to create machines', async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: '20000000-0000-4000-8000-000000000001', name: 'Racer', status: 'ACTIVE' }],
      rowCount: 1,
    }));
    const { origin } = await serve(query);
    const response = await fetch(`${origin}/v1/machines`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
        'x-auth-roles': 'STAFF',
      },
      body: JSON.stringify({ name: 'Racer', status: 'ACTIVE' }),
    });
    expect(response.status).toBe(201);
  });

  it('lets staff update a machine and rejects a missing one', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ id: '20000000-0000-4000-8000-000000000001', name: 'Racer', status: 'MAINTENANCE' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const { origin, redis } = await serve(query);
    const headers = {
      'content-type': 'application/json',
      'x-auth-subject': '10000000-0000-4000-8000-000000000001',
      'x-auth-roles': 'STAFF',
    };
    const updated = await fetch(`${origin}/v1/machines/20000000-0000-4000-8000-000000000001`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'MAINTENANCE' }),
    });
    expect(updated.status).toBe(200);
    expect(redis.delete).toHaveBeenCalled();
    const missing = await fetch(`${origin}/v1/machines/20000000-0000-4000-8000-000000000099`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Gone' }),
    });
    expect(missing.status).toBe(404);
  });

  it('lets staff delete a machine and denies customers', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: '20000000-0000-4000-8000-000000000001' }], rowCount: 1 }));
    const { origin } = await serve(query);
    const removed = await fetch(`${origin}/v1/machines/20000000-0000-4000-8000-000000000001`, {
      method: 'DELETE',
      headers: {
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
        'x-auth-roles': 'STAFF',
      },
    });
    expect(removed.status).toBe(204);
    const denied = await fetch(`${origin}/v1/machines/20000000-0000-4000-8000-000000000001`, {
      method: 'DELETE',
      headers: {
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
        'x-auth-roles': 'CUSTOMER',
      },
    });
    expect(denied.status).toBe(403);
  });
});

describe('catalog cache-aside', () => {
  const headers = {
    'x-auth-subject': '10000000-0000-4000-8000-000000000001',
    'x-auth-roles': 'CUSTOMER',
  };

  it('returns a cache hit without querying PostgreSQL', async () => {
    const machines = [{ id: '20000000-0000-4000-8000-000000000001', name: 'Racer' }];
    const query = vi.fn();
    const { origin } = await serve(query, {
      get: vi.fn(async () => JSON.stringify(machines)),
    });
    const response = await fetch(`${origin}/v1/machines`, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cache: 'hit', data: machines });
    expect(query).not.toHaveBeenCalled();
  });

  it('falls back to PostgreSQL when Redis is down', async () => {
    const rows = [{ id: '20000000-0000-4000-8000-000000000001', name: 'Racer' }];
    const query = vi.fn(async () => ({ rows, rowCount: 1 }));
    const { origin } = await serve(query, {
      get: vi.fn(async () => null),
      isReady: () => false,
    });
    const response = await fetch(`${origin}/v1/machines`, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cache: 'bypass', data: rows });
    expect(query).toHaveBeenCalled();
  });
});
