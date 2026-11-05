import type { AuthContext } from '@arcade/service-auth';

export type PayableBooking = {
  id: string;
  userId: string;
  customerEmail?: string;
  amountCents: number;
  currency: string;
  status: string;
};

type BookingWire = {
  id?: string;
  userId?: string;
  user_id?: string;
  customerEmail?: string;
  customer_email?: string;
  amountCents?: number;
  amount_cents?: number;
  currency?: string;
  status?: string;
};

export function bookingLookup(baseUrl: string) {
  return async (bookingId: string, auth: AuthContext): Promise<PayableBooking | null> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/bookings/${bookingId}`, {
      headers: {
        'x-auth-subject': auth.subject,
        'x-auth-roles': [...auth.roles].join(','),
        ...(auth.email ? { 'x-auth-email': auth.email } : {}),
      },
    });
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok) {
      throw new Error(`Booking lookup failed (${response.status})`);
    }
    const body = await response.json() as { data?: BookingWire };
    const row = body.data;
    if (!row?.id || !row.status) return null;
    const userId = String(row.userId ?? row.user_id ?? '');
    const amountCents = Number(row.amountCents ?? row.amount_cents);
    const currency = String(row.currency ?? '');
    if (!userId || !Number.isInteger(amountCents) || amountCents <= 0 || currency.length !== 3) {
      return null;
    }
    return {
      id: String(row.id),
      userId,
      amountCents,
      currency,
      status: row.status,
      ...(row.customerEmail ?? row.customer_email
        ? { customerEmail: String(row.customerEmail ?? row.customer_email) }
        : {}),
    };
  };
}
