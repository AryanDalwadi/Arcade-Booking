import { randomUUID } from 'node:crypto';

export type CheckoutSession = {
  orderId: string;
  keyId: string;
  provider: 'SIMULATED' | 'RAZORPAY';
};

export interface OrderGateway {
  createOrder(input: {
    amountCents: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<CheckoutSession>;
  findCapturedPayment?(orderId: string): Promise<{ paymentId: string } | null>;
}

export class SimulatedOrderGateway implements OrderGateway {
  async createOrder(): Promise<CheckoutSession> {
    return {
      orderId: `order_sim_${randomUUID().replaceAll('-', '')}`,
      keyId: 'rzp_test_simulated',
      provider: 'SIMULATED',
    };
  }
}

export class RazorpayOrderGateway implements OrderGateway {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
  ) {}

  async createOrder(input: {
    amountCents: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<CheckoutSession> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        receipt: input.receipt.slice(0, 40),
        notes: input.notes,
      }),
    });
    const body = await response.json().catch(() => null) as { id?: string; error?: { description?: string } } | null;
    if (!response.ok || !body?.id) {
      throw new Error(body?.error?.description ?? `Razorpay order failed (${response.status})`);
    }
    return { orderId: body.id, keyId: this.keyId, provider: 'RAZORPAY' };
  }

  async findCapturedPayment(orderId: string): Promise<{ paymentId: string } | null> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const body = await response.json().catch(() => null) as {
      items?: { id?: string; status?: string }[];
    } | null;
    const captured = body?.items?.find((item) => item.status === 'captured' && item.id);
    return captured?.id ? { paymentId: captured.id } : null;
  }
}
