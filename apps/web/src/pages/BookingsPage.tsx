import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageTitle, ResourceMessage } from '../components/ui';
import { createBooking, fetchBookings } from '../features/bookingsSlice';
import { confirmRazorpayCheckout, createCheckoutOrder, simulateCheckout } from '../features/paymentsSlice';
import { openRazorpayCheckout } from '../features/razorpayCheckout';
import { fetchMachines } from '../features/catalogSlice';
import { fetchUsers } from '../features/identitySlice';
import { useAppDispatch, useAppSelector } from '../store';

export function BookingsPage({ portal }: { portal: 'customer' | 'admin' }) {
  const [machineId, setMachineId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { machines, status: machinesStatus } = useAppSelector((state) => state.catalog);
  const { users } = useAppSelector((state) => state.identity);
  const { bookings, listStatus, createStatus, listError, createError } =
    useAppSelector((state) => state.bookings);
  const { payingBookingId, payError } = useAppSelector((state) => state.payments);
  const availableMachines = machines.filter((machine) => machine.status === 'ACTIVE');
  const visibleBookings = useMemo(
    () => portal === 'admin' ? bookings : bookings.filter((booking) => booking.userId === user?.id),
    [bookings, portal, user?.id],
  );

  useEffect(() => {
    void dispatch(fetchMachines());
  }, [dispatch]);

  useEffect(() => {
    if (portal === 'admin') void dispatch(fetchUsers());
  }, [dispatch, portal]);

  useEffect(() => {
    void dispatch(fetchBookings(portal === 'admin' ? undefined : user?.id));
  }, [dispatch, portal, user?.id]);

  useEffect(() => {
    if (!machineId && availableMachines[0]) setMachineId(availableMachines[0].id);
  }, [availableMachines, machineId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !machineId) return;
    try {
      await dispatch(createBooking({
        machineId,
        startAt: new Date(startAt).toISOString(),
        durationMinutes,
        ...(user.email ? { customerEmail: user.email } : {}),
      })).unwrap();
      setStartAt('');
    } catch {
      // Redux state renders the API error.
    }
  }

  async function pay(bookingId: string) {
    try {
      const order = await dispatch(createCheckoutOrder(bookingId)).unwrap();
      if (order.alreadyPaid) {
        await dispatch(fetchBookings(portal === 'admin' ? undefined : user?.id));
        return;
      }
      if (order.provider === 'SIMULATED') {
        await dispatch(simulateCheckout({ bookingId, outcome: 'SUCCEED' })).unwrap();
      } else {
        const paid = await openRazorpayCheckout({
          keyId: order.keyId,
          amountCents: order.amountCents,
          currency: order.currency,
          orderId: order.orderId,
        });
        await dispatch(confirmRazorpayCheckout({
          bookingId,
          orderId: paid.razorpay_order_id,
          paymentId: paid.razorpay_payment_id,
          signature: paid.razorpay_signature,
        })).unwrap();
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const latest = await dispatch(fetchBookings(portal === 'admin' ? undefined : user?.id)).unwrap();
          const current = latest.find((booking) => booking.id === bookingId);
          if (current && current.status !== 'PENDING_PAYMENT') break;
        }
        return;
      }
      await dispatch(fetchBookings(portal === 'admin' ? undefined : user?.id));
    } catch {
      // payError renders from Redux.
    }
  }

  return (
    <>
      <PageTitle
        eyebrow={portal === 'admin' ? 'OPERATIONS' : 'BOOKINGS'}
        title={portal === 'admin' ? 'All customer bookings' : 'Reserve a session'}
      />
      {portal === 'customer' && <form className="booking panel" onSubmit={submit}>
        <label>Arcade machine
          <select value={machineId} onChange={(event) => setMachineId(event.target.value)} required>
            <option value="">Select a machine</option>
            {availableMachines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
          </select>
        </label>
        {machinesStatus === 'loading' && <ResourceMessage kind="loading">Loading available machines…</ResourceMessage>}
        {machinesStatus === 'succeeded' && availableMachines.length === 0 && <ResourceMessage kind="empty">No active machines are available.</ResourceMessage>}
        <label>Start time<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required /></label>
        <label>Duration in minutes
          <input type="number" min={15} max={480} step={15} value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.valueAsNumber)} required />
        </label>
        <p className="sandbox-note">The final amount is calculated from Catalog pricing by the Booking service. Checkout uses Razorpay test mode (or a labeled simulated capture when test keys are absent).</p>
        <button className="primary" disabled={createStatus === 'loading' || !machineId}>
          {createStatus === 'loading' ? 'Reserving…' : 'Confirm booking'}
        </button>
        {createError && <div className="error" role="alert">{createError}</div>}
        {payError && <div className="error" role="alert">{payError}</div>}
        {createStatus === 'succeeded' && <div className="notice" role="status">Booking created successfully.</div>}
      </form>}
      <section className="booking-list">
        <h2>{portal === 'admin' ? 'Platform bookings' : 'My bookings'}</h2>
        {listStatus === 'loading' && <ResourceMessage kind="loading">Loading bookings…</ResourceMessage>}
        {listStatus === 'failed' && (
          <ResourceMessage kind="error">
            {listError} <button className="text-button" onClick={() => void dispatch(fetchBookings(portal === 'admin' ? undefined : user?.id))}>Retry</button>
          </ResourceMessage>
        )}
        {listStatus === 'succeeded' && visibleBookings.length === 0 && <ResourceMessage kind="empty">You have no bookings yet.</ResourceMessage>}
        {visibleBookings.length > 0 && (
          <div className="panel table-wrap">
            <table>
              <thead><tr>{portal === 'admin' && <th>User</th>}<th>Machine</th><th>Start</th><th>Duration</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{visibleBookings.map((booking) => (
                <tr key={booking.id}>
                  {portal === 'admin' && <td>{userLabel(booking.userId, users)}</td>}
                  <td>{machines.find((machine) => machine.id === booking.machineId)?.name ?? booking.machineId}</td>
                  <td>{new Date(booking.startAt).toLocaleString()}</td>
                  <td>{booking.durationMinutes} min</td>
                  <td>{formatMoney(booking.amountCents, booking.currency)}</td>
                  <td>
                    <div className="status-cell">
                      <b className="status-pill">{booking.status.replaceAll('_', ' ')}</b>
                      {booking.status === 'PENDING_PAYMENT' && (
                        <button
                          className="primary pay-now"
                          disabled={payingBookingId === booking.id}
                          onClick={() => void pay(booking.id)}
                        >
                          {payingBookingId === booking.id ? 'Starting checkout…' : 'Pay now'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function userLabel(userId: string, users: { id: string; displayName: string; email: string }[]): string {
  const match = users.find((candidate) => candidate.id === userId);
  return match ? `${match.displayName} (${match.email})` : userId;
}

function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}
