export type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = {
  open: () => void;
};

type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}) => RazorpayCheckout;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export async function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return window.Razorpay;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
    document.body.appendChild(script);
  });
  if (!window.Razorpay) throw new Error('Razorpay Checkout is unavailable');
  return window.Razorpay;
}

export function openRazorpayCheckout(input: {
  keyId: string;
  amountCents: number;
  currency: string;
  orderId: string;
}): Promise<RazorpaySuccessResponse> {
  return loadRazorpay().then((Razorpay) => new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: input.keyId,
      amount: input.amountCents,
      currency: input.currency,
      order_id: input.orderId,
      name: 'Neon Arcade',
      description: 'Razorpay test mode checkout',
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Checkout closed')) },
    });
    checkout.open();
  }));
}
