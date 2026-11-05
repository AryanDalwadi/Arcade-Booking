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

describe('checkout without a Kafka payment row', () => {
  it('creates a pending payment from the booking and starts checkout', async () => {
    const bookingId = '30000000-0000-4000-8000-000000000001';
    const userId = '10000000-0000-4000-8000-000000000001';
    let inserted = false;
    const payment = {
      id: '20000000-0000-4000-8000-000000000001',
      booking_id: bookingId,
      user_id: userId,
      customer_email: 'player@example.com',
      amount_cents: 6000,
      currency: 'INR',
      idempotency_key: `booking:${bookingId}`,
      status: 'PENDING',
      provider: 'SIMULATED',
      provider_reference: 'pending',
      razorpay_order_id: null,
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO payments')) {
        inserted = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT * FROM payments')) {
        return { rows: inserted ? [payment] : [], rowCount: inserted ? 1 : 0 };
      }
      return { rows: [], rowCount: 1 };
    });
    const db = { query } as unknown as Postgres;
    const app = createHttpApp({
      dbReady: async () => true,
      dependencyReady: () => true,
      routes: paymentRoutes(db, {
        gateway: { createOrder: async () => ({ orderId: 'order_sim_test', keyId: 'rzp_test_simulated', provider: 'SIMULATED' }) },
        publicKeyId: 'rzp_test_simulated',
        webhookSecret: 'whsec_test',
        lookupPayableBooking: async () => ({
          id: bookingId,
          userId,
          amountCents: 6000,
          currency: 'INR',
          status: 'PENDING_PAYMENT',
          customerEmail: 'player@example.com',
        }),
      }),
    });
    const server = createServer(app).listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(`${origin}/v1/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-subject': userId,
        'x-auth-roles': 'CUSTOMER',
      },
      body: JSON.stringify({ bookingId }),
    });
    expect(response.status).toBe(201);
    expect(inserted).toBe(true);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { bookingId, orderId: 'order_sim_test', provider: 'SIMULATED' },
    });
  });
});

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
