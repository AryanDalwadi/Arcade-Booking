import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { formatMoney } from '../money';
import { payForBooking } from '../pay';

type BookingRow = {
  id: string;
  machineId: string | null;
  venueId: string | null;
  packageCode: string | null;
  guestCount: number | null;
  startAt: string;
  durationMinutes: number;
  amountCents: number;
  currency: string;
  status: string;
  paymentStatus?: string;
};

export function AccountPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState('');

  function load() {
    if (!token) return;
    api<Array<Record<string, unknown>>>('/api/booking/bookings', {}, token)
      .then((data) => setRows(data.map(normalize)))
      .catch((reason: Error) => setError(reason.message));
  }

  useEffect(load, [token]);

  async function pay(id: string) {
    if (!token) return;
    setPaying(id);
    setError('');
    try {
      await payForBooking(id, token);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Payment failed');
    } finally {
      setPaying('');
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl">My bookings</h1>
      {error && <p className="mt-4 text-danger">{error}</p>}
      {rows && rows.length === 0 && <p className="mt-6">No bookings yet. <Link to="/book" className="text-mint">Book a machine or a party</Link>.</p>}
      <ul className="mt-6 space-y-3">
        {(rows ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-panel p-5">
            <div>
              <p className="font-display text-xl">{row.packageCode ? `${row.packageCode} party` : 'Machine booking'}</p>
              <p className="text-sm text-muted">
                {new Date(row.startAt).toLocaleString()} · {row.durationMinutes} min
                {row.guestCount ? ` · ${row.guestCount} guests` : ''}
              </p>
              <p className="mt-1 text-sm">{formatMoney(row.amountCents, row.currency)} · {label(row.status)}</p>
            </div>
            {row.status === 'PENDING_PAYMENT' && (
              <button type="button" disabled={paying === row.id} onClick={() => pay(row.id)} className="rounded-full bg-mint px-4 py-2 font-semibold text-mint-ink">
                {paying === row.id ? 'Paying…' : 'Pay now'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function label(status: string) {
  return status.replaceAll('_', ' ');
}

function normalize(row: Record<string, unknown>): BookingRow {
  const read = (camel: string, snake: string) => row[camel] ?? row[snake];
  return {
    id: String(row.id),
    machineId: read('machineId', 'machine_id') ? String(read('machineId', 'machine_id')) : null,
    venueId: read('venueId', 'venue_id') ? String(read('venueId', 'venue_id')) : null,
    packageCode: read('packageCode', 'package_code') ? String(read('packageCode', 'package_code')) : null,
    guestCount: read('guestCount', 'guest_count') == null ? null : Number(read('guestCount', 'guest_count')),
    startAt: new Date(String(read('startAt', 'start_at'))).toISOString(),
    durationMinutes: Number(read('durationMinutes', 'duration_minutes')),
    amountCents: Number(read('amountCents', 'amount_cents')),
    currency: String(row.currency),
    status: String(row.status),
    paymentStatus: read('paymentStatus', 'payment_status') ? String(read('paymentStatus', 'payment_status')) : undefined,
  };
}
