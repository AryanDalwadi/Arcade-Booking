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

async function serve(query: ReturnType<typeof vi.fn>): Promise<string> {
  const db = { query } as unknown as Postgres;
  const redis = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
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

describe('catalog authorization', () => {
  it('allows authenticated customers to browse but denies mutations', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const origin = await serve(query);
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
    const origin = await serve(query);
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
});
