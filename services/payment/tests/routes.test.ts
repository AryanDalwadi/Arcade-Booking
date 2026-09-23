import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Postgres } from '../src/adapters/postgres';
import { paymentRoutes } from '../src/application/context';
import { createHttpApp } from '../src/http/app';

const servers: Server[] = [];
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
    routes: paymentRoutes(db, {
      gateway: { createOrder: async () => ({ orderId: 'order_sim_test', keyId: 'rzp_test_simulated', provider: 'SIMULATED' }) },
      publicKeyId: 'rzp_test_simulated',
      webhookSecret: 'whsec_test',
    }),
  });
  const server = createServer(app).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('payment authorization', () => {
  it('denies customer access to payment records', async () => {
    const query = vi.fn();
    const origin = await serve(query);
    const response = await fetch(
      `${origin}/v1/payments/20000000-0000-4000-8000-000000000001`,
      {
        headers: {
          'x-auth-subject': '10000000-0000-4000-8000-000000000001',
          'x-auth-roles': 'CUSTOMER',
        },
      },
    );
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows staff to read payment records', async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: '20000000-0000-4000-8000-000000000001' }],
      rowCount: 1,
    }));
    const origin = await serve(query);
    const response = await fetch(
      `${origin}/v1/payments/20000000-0000-4000-8000-000000000001`,
      {
        headers: {
          'x-auth-subject': '10000000-0000-4000-8000-000000000001',
          'x-auth-roles': 'STAFF',
        },
      },
    );
    expect(response.status).toBe(200);
  });
});
