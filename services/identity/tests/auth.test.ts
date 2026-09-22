import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapAdmin, identityRoutes } from '../src/application/context';
import { Postgres } from '../src/adapters/postgres';
import { parseEnv } from '../src/config/env';
import { createHttpApp } from '../src/http/app';

const servers: Server[] = [];
const env = parseEnv({
  NODE_ENV: 'test',
  JWT_SECRET: 'identity-test-secret-with-32-characters',
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))));
});

async function serve(query: ReturnType<typeof vi.fn>): Promise<string> {
  const db = { query } as unknown as Postgres;
  const app = createHttpApp({
    dbReady: async () => true,
    dependencyReady: () => true,
    routes: identityRoutes(db, env),
  });
  const server = createServer(app).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function userRow(passwordHash: string) {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'player@example.com',
    display_name: 'Test Player',
    password_hash: passwordHash,
    roles: ['CUSTOMER'],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('identity authentication', () => {
  it('registers a user with a bcrypt hash and never returns the hash', async () => {
    let insertedHash = '';
    const query = vi.fn(async (_sql: string, values: unknown[]) => {
      insertedHash = String(values[2]);
      return { rows: [userRow(insertedHash)], rowCount: 1 };
    });
    const origin = await serve(query);

    const response = await fetch(`${origin}/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'player@example.com',
        password: 'ArcadePass123!',
        displayName: 'Test Player',
      }),
    });
    const body = await response.json() as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(insertedHash).not.toBe('ArcadePass123!');
    expect(await bcrypt.compare('ArcadePass123!', insertedHash)).toBe(true);
    expect(body.data).not.toHaveProperty('password_hash');
  });

  it('returns a conflict when the email already exists', async () => {
    const origin = await serve(vi.fn(async () => ({ rows: [], rowCount: 0 })));
    const response = await fetch(`${origin}/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'player@example.com',
        password: 'ArcadePass123!',
        displayName: 'Test Player',
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('issues a scoped JWT for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('ArcadePass123!', 4);
    const origin = await serve(vi.fn(async () => ({
      rows: [userRow(passwordHash)],
      rowCount: 1,
    })));
    const response = await fetch(`${origin}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'player@example.com', password: 'ArcadePass123!' }),
    });
    const body = await response.json() as { data: { token: string } };
    const claims = jwt.verify(body.data.token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    expect(response.status).toBe(200);
    expect(claims).toMatchObject({
      sub: '10000000-0000-4000-8000-000000000001',
      roles: ['CUSTOMER'],
    });
  });
});

describe('identity authorization', () => {
  it('denies CUSTOMER access to the user directory', async () => {
    const query = vi.fn();
    const origin = await serve(query);
    const response = await fetch(`${origin}/v1/users`, {
      headers: {
        'x-auth-subject': '10000000-0000-4000-8000-000000000001',
        'x-auth-roles': 'CUSTOMER',
      },
    });
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows STAFF to read users but not mutate groups', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const origin = await serve(query);
    const headers = {
      'content-type': 'application/json',
      'x-auth-subject': '10000000-0000-4000-8000-000000000001',
      'x-auth-roles': 'STAFF',
    };
    expect((await fetch(`${origin}/v1/users`, { headers })).status).toBe(200);
    expect((await fetch(`${origin}/v1/user-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Tournament Team' }),
    })).status).toBe(403);
  });

  it('allows ADMIN to create custom groups but not reserved system groups', async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: '20000000-0000-4000-8000-000000000001', name: 'Tournament Team' }],
      rowCount: 1,
    }));
    const origin = await serve(query);
    const headers = {
      'content-type': 'application/json',
      'x-auth-subject': '10000000-0000-4000-8000-000000000001',
      'x-auth-roles': 'ADMIN',
    };
    expect((await fetch(`${origin}/v1/user-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Tournament Team' }),
    })).status).toBe(201);
    expect((await fetch(`${origin}/v1/user-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'ADMIN' }),
    })).status).toBe(409);
  });

  it('bootstraps only an existing email into ADMIN', async () => {
    const query = vi.fn(async (_sql: string, values: unknown[]) => {
      void _sql;
      return { rows: [{ found: true }], rowCount: 1, values };
    });
    const found = await bootstrapAdmin({ query } as unknown as Postgres, 'Admin@Example.com');
    expect(found).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual(['admin@example.com']);
  });

  it('refuses to remove the last administrator', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT name FROM user_groups')) {
          return { rows: [{ name: 'ADMIN' }], rowCount: 1 };
        }
        if (sql.includes('SELECT 1 FROM user_group_members')) {
          return { rows: [{}], rowCount: 1 };
        }
        if (sql.includes('SELECT count(*)')) {
          return { rows: [{ count: '1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const db = {
      query: vi.fn(),
      transaction: async (work: (value: typeof client) => Promise<unknown>) => work(client),
    } as unknown as Postgres;
    const app = createHttpApp({
      dbReady: async () => true,
      dependencyReady: () => true,
      routes: identityRoutes(db, env),
    });
    const server = createServer(app).listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(
      `${origin}/v1/user-groups/20000000-0000-4000-8000-000000000001/users/10000000-0000-4000-8000-000000000001`,
      {
        method: 'DELETE',
        headers: {
          'x-auth-subject': '10000000-0000-4000-8000-000000000001',
          'x-auth-roles': 'ADMIN',
        },
      },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'LAST_ADMIN_REQUIRED' });
  });
});
