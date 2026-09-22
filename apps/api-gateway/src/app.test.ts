import { type AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import type { RateLimitStore } from './rate-limit.js';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
});

function config(overrides: NodeJS.ProcessEnv = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'a-test-secret-with-32-characters',
    ...overrides,
  });
}

async function serve(overrides: NodeJS.ProcessEnv = {}) {
  const server = createApp(config(overrides)).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  return `http://127.0.0.1:${port}`;
}

async function serveUpstream(
  handler: Parameters<typeof createServer>[0],
): Promise<string> {
  const server = createServer(handler).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('API gateway', () => {
  it('reports health and returns a correlation ID', async () => {
    const origin = await serve();
    const response = await fetch(`${origin}/health`, { headers: { 'x-correlation-id': 'test-request' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-correlation-id')).toBe('test-request');
    expect(await response.json()).toMatchObject({ status: 'ok', service: 'api-gateway' });
  });

  it('protects service routes', async () => {
    const origin = await serve();
    const response = await fetch(`${origin}/api/catalog/machines`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('proxies public identity routes to the service v1 API', async () => {
    const upstream = await serveUpstream((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ path: request.url }));
    });
    const origin = await serve({ IDENTITY_SERVICE_URL: upstream });
    const response = await fetch(`${origin}/api/identity/auth/login`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: '/v1/auth/login' });
  });

  it('forwards verified identity claims to protected services', async () => {
    const upstream = await serveUpstream((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        subject: request.headers['x-auth-subject'],
        roles: request.headers['x-auth-roles'],
      }));
    });
    const secret = 'a-test-secret-with-32-characters';
    const token = jwt.sign({ sub: 'user-123', roles: ['CUSTOMER'] }, secret);
    const origin = await serve({ CATALOG_SERVICE_URL: upstream, JWT_SECRET: secret });
    const response = await fetch(`${origin}/api/catalog/machines`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-auth-subject': 'attacker',
        'x-auth-roles': 'ADMIN',
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subject: 'user-123', roles: 'CUSTOMER' });
  });

  it('blocks customer mutations and allows staff catalog mutations', async () => {
    const upstream = await serveUpstream((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ success: true }));
    });
    const secret = 'a-test-secret-with-32-characters';
    const origin = await serve({ CATALOG_SERVICE_URL: upstream, JWT_SECRET: secret });
    const customer = jwt.sign({ sub: 'customer-1', roles: ['CUSTOMER'] }, secret);
    const staff = jwt.sign({ sub: 'staff-1', roles: ['STAFF'] }, secret);

    expect((await fetch(`${origin}/api/catalog/machines`, {
      method: 'POST',
      headers: { authorization: `Bearer ${customer}` },
    })).status).toBe(403);
    expect((await fetch(`${origin}/api/catalog/machines`, {
      method: 'POST',
      headers: { authorization: `Bearer ${staff}` },
    })).status).toBe(200);
  });

  it('keeps analytics utilization on staff routes only', async () => {
    const upstream = await serveUpstream((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ success: true, data: { venueMinutes: 0 } }));
    });
    const secret = 'a-test-secret-with-32-characters';
    const origin = await serve({ ANALYTICS_SERVICE_URL: upstream, JWT_SECRET: secret });
    const customer = jwt.sign({ sub: 'customer-1', roles: ['CUSTOMER'] }, secret);
    const staff = jwt.sign({ sub: 'staff-1', roles: ['STAFF'] }, secret);
    expect((await fetch(`${origin}/api/analytics/utilization`, {
      headers: { authorization: `Bearer ${customer}` },
    })).status).toBe(403);
    expect((await fetch(`${origin}/api/analytics/utilization`, {
      headers: { authorization: `Bearer ${staff}` },
    })).status).toBe(200);
  });

  it('reserves identity group mutations for administrators', async () => {
    const secret = 'a-test-secret-with-32-characters';
    const origin = await serve({ JWT_SECRET: secret });
    const staff = jwt.sign({ sub: 'staff-1', roles: ['STAFF'] }, secret);
    const response = await fetch(`${origin}/api/identity/user-groups`, {
      method: 'POST',
      headers: { authorization: `Bearer ${staff}` },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'ROLE_REQUIRED' });
  });

  it('keeps live healthy while readiness drains', async () => {
    const server = createApp(config(), undefined, () => false).listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect((await fetch(`${origin}/health/live`)).status).toBe(200);
    const ready = await fetch(`${origin}/health`);
    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({ status: 'draining', service: 'api-gateway' });
  });

  it('limits repeated requests by client', async () => {
    const origin = await serve({ RATE_LIMIT_MAX: '1' });
    expect((await fetch(`${origin}/api/catalog/machines`)).status).toBe(401);
    expect((await fetch(`${origin}/api/catalog/machines`)).status).toBe(429);
  });

  it('fails open when the rate-limit store is unavailable', async () => {
    const store: RateLimitStore = {
      increment: async () => {
        throw new Error('Redis down');
      },
    };
    const server = createApp(config({ RATE_LIMIT_MAX: '1' }), store).listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect((await fetch(`${origin}/api/catalog/machines`)).status).toBe(401);
    expect((await fetch(`${origin}/api/catalog/machines`)).status).toBe(401);
  });
});
