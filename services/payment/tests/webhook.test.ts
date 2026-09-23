import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Postgres } from '../src/adapters/postgres';
import { expirePendingPayments, finalizePayment, handleInventoryReserved, paymentRoutes } from '../src/application/context';
import { createHttpApp } from '../src/http/app';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))));
});

const pending = {
  id: '20000000-0000-4000-8000-000000000001',
  booking_id: '30000000-0000-4000-8000-000000000001',
  user_id: '10000000-0000-4000-8000-000000000001',
  customer_email: 'player@example.com',
  amount_cents: 6000,
  currency: 'INR',
  idempotency_key: 'booking:30000000-0000-4000-8000-000000000001',
  status: 'PENDING' as const,
  provider: 'RAZORPAY' as const,
  provider_reference: 'pending',
  razorpay_order_id: 'order_test123',
};

function sign(body: string, secret = 'whsec_test'): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function serve(db: Postgres): Promise<string> {
  const app = createHttpApp({
    dbReady: async () => true,
    dependencyReady: () => true,
    routes: paymentRoutes(db, {
      gateway: { createOrder: async () => ({ orderId: 'order_new', keyId: 'rzp_test_key', provider: 'RAZORPAY' }) },
      publicKeyId: 'rzp_test_key',
      webhookSecret: 'whsec_test',
      keySecret: 'key_secret_test',
    }),
  });
  const server = createServer(app).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('Razorpay webhook and pending payments', () => {
  it('rejects an invalid webhook signature', async () => {
    const origin = await serve({ query: vi.fn() } as unknown as Postgres);
    const body = JSON.stringify({ event: 'payment.captured' });
    const response = await fetch(`${origin}/v1/webhooks/razorpay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'deadbeef' },
      body,
    });
    expect(response.status).toBe(401);
  });

  it('finalizes a pending payment once and ignores a duplicate capture', async () => {
    const state = { ...pending };
    const outbox: unknown[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) return { rows: [{ ...state }], rowCount: 1 };
        if (sql.includes('UPDATE payments')) {
          state.status = 'COMPLETED';
          state.provider_reference = 'pay_abc';
          return { rows: [{ ...state }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO outbox')) {
          outbox.push(sql);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('razorpay_order_id')) return { rows: [{ ...state }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      transaction: async (work: (value: typeof client) => Promise<unknown>) => work(client),
    } as unknown as Postgres;
    const origin = await serve(db);
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_abc', order_id: pending.razorpay_order_id } } },
    });
    const headers = { 'content-type': 'application/json', 'x-razorpay-signature': sign(payload) };
    expect((await fetch(`${origin}/v1/webhooks/razorpay`, { method: 'POST', headers, body: payload })).status).toBe(200);
    expect((await fetch(`${origin}/v1/webhooks/razorpay`, { method: 'POST', headers, body: payload })).status).toBe(200);
    expect(outbox).toHaveLength(1);
  });

  it('creates a pending row from inventory reserved without charging', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    await handleInventoryReserved({ query } as unknown as Postgres, {
      eventId: randomUUID(),
      eventType: 'arcade.inventory.reserved.v1',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      producer: 'inventory',
      payload: {
        bookingId: pending.booking_id,
        userId: pending.user_id,
        customerEmail: pending.customer_email,
        machineId: randomUUID(),
        startAt: new Date().toISOString(),
        durationMinutes: 60,
        amountCents: 6000,
        currency: 'INR',
      },
    });
    expect(String(query.mock.calls[0]?.[0])).toContain('PENDING');
    expect(query.mock.calls[0]?.[1]).toEqual(expect.arrayContaining([pending.booking_id, pending.user_id]));
  });

  it('does not emit a second outbox row when finalize sees a completed payment', async () => {
    const completed = { ...pending, status: 'COMPLETED' as const };
    const outbox = vi.fn();
    const db = {
      transaction: async (work: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => work({
        query: vi.fn(async (sql: string) => {
          if (sql.includes('INSERT INTO outbox')) { outbox(); return { rows: [], rowCount: 1 }; }
          return { rows: [completed], rowCount: 1 };
        }),
      }),
    } as unknown as Postgres;
    const row = await finalizePayment(db, completed.id, 'COMPLETED', 'pay_dup');
    expect(row?.status).toBe('COMPLETED');
    expect(outbox).not.toHaveBeenCalled();
  });

  it('expires stale pending payments as failed', async () => {
    const state = { ...pending };
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("status='PENDING'")) return { rows: [{ ...state }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      transaction: async (work: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => work({
        query: vi.fn(async (sql: string) => {
          if (sql.includes('FOR UPDATE')) return { rows: [{ ...state }], rowCount: 1 };
          if (sql.includes('UPDATE payments')) {
            state.status = 'FAILED';
            return { rows: [{ ...state }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      }),
    } as unknown as Postgres;
    expect(await expirePendingPayments(db, 600)).toBe(1);
    expect(state.status).toBe('FAILED');
  });

  it('confirms a checkout payment with a valid Razorpay signature', async () => {
    const state = { ...pending };
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM payments')) return { rows: [{ ...state }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      transaction: async (work: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => work({
        query: vi.fn(async (sql: string) => {
          if (sql.includes('FOR UPDATE')) return { rows: [{ ...state }], rowCount: 1 };
          if (sql.includes('UPDATE payments')) {
            state.status = 'COMPLETED';
            state.provider_reference = 'pay_checkout';
            return { rows: [{ ...state }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      }),
    } as unknown as Postgres;
    const origin = await serve(db);
    const signature = sign(`${pending.razorpay_order_id}|pay_checkout`, 'key_secret_test');
    const response = await fetch(`${origin}/v1/orders/${pending.booking_id}/confirm`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-subject': pending.user_id!,
        'x-auth-roles': 'CUSTOMER',
      },
      body: JSON.stringify({
        orderId: pending.razorpay_order_id,
        paymentId: 'pay_checkout',
        signature,
      }),
    });
    expect(response.status).toBe(200);
    expect(state.status).toBe('COMPLETED');
  });
});
