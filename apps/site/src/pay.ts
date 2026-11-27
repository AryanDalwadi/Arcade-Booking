import type { CheckoutOrder, ConfirmRazorpayPaymentRequest } from '@arcade/contracts';
import { api, ApiError } from './api';

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = { open: () => void };
type CheckoutContact = {
  name?: string;
  email?: string;
  contact?: string;
  description?: string;
};

type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}) => RazorpayCheckout;

declare global {
  interface Window { Razorpay?: RazorpayConstructor }
}

async function checkoutOrder(bookingId: string, token: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await api<CheckoutOrder>('/api/payment/orders', {
        method: 'POST',
        body: JSON.stringify({ bookingId }),
      }, token);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Checkout is still preparing');
}

function openRazorpay(order: CheckoutOrder, contact?: CheckoutContact) {
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    const Checkout = window.Razorpay;
    if (!Checkout) {
      reject(new Error('Razorpay Checkout is unavailable'));
      return;
    }
    const checkout = new Checkout({
      key: order.keyId,
      amount: order.amountCents,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Neon Arcade',
      description: contact?.description || 'Arcade booking',
      prefill: {
        ...(contact?.name ? { name: contact.name } : {}),
        ...(contact?.email ? { email: contact.email } : {}),
        ...(contact?.contact ? { contact: contact.contact } : {}),
      },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Checkout closed')) },
    });
    checkout.open();
  });
}

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
    document.body.appendChild(script);
  });
}

export async function payForBooking(bookingId: string, token: string, contact?: CheckoutContact) {
  const order = await checkoutOrder(bookingId, token);
  if (order.alreadyPaid) return;
  if (order.provider === 'RAZORPAY') {
    await loadRazorpay();
    const paid = await openRazorpay(order, contact);
    const body: ConfirmRazorpayPaymentRequest = {
      orderId: paid.razorpay_order_id,
      paymentId: paid.razorpay_payment_id,
      signature: paid.razorpay_signature,
    };
    await api(`/api/payment/orders/${bookingId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, token);
    return;
  }
  await api(`/api/payment/orders/${bookingId}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ outcome: 'SUCCEED' }),
  }, token);
}
