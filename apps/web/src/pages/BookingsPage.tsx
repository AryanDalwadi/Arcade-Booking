import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageTitle, ResourceMessage } from '../components/ui';
import { createBooking, fetchBookings } from '../features/bookingsSlice';
import { fetchMachines } from '../features/catalogSlice';
import { useAppDispatch, useAppSelector } from '../store';

export function BookingsPage({ portal }: { portal: 'customer' | 'admin' }) {
  const [machineId, setMachineId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { machines, status: machinesStatus } = useAppSelector((state) => state.catalog);
  const { bookings, listStatus, createStatus, listError, createError } =
    useAppSelector((state) => state.bookings);
  const availableMachines = machines.filter((machine) => machine.status === 'ACTIVE');

  useEffect(() => {
    if (machinesStatus === 'idle') void dispatch(fetchMachines());
    if (listStatus === 'idle') void dispatch(fetchBookings(portal === 'admin' ? undefined : user?.id));
  }, [dispatch, listStatus, machinesStatus, portal, user?.id]);

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
      })).unwrap();
      setStartAt('');
    } catch {
      // Redux state renders the API error.
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
        <p className="sandbox-note">The final amount is calculated from Catalog pricing by the Booking service.</p>
        <button className="primary" disabled={createStatus === 'loading' || !machineId}>
          {createStatus === 'loading' ? 'Reserving…' : 'Confirm booking'}
        </button>
        {createError && <div className="error" role="alert">{createError}</div>}
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
        {listStatus === 'succeeded' && bookings.length === 0 && <ResourceMessage kind="empty">You have no bookings yet.</ResourceMessage>}
        {bookings.length > 0 && (
          <div className="panel table-wrap">
            <table>
              <thead><tr>{portal === 'admin' && <th>User</th>}<th>Machine</th><th>Start</th><th>Duration</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{bookings.map((booking) => (
                <tr key={booking.id}>
                  {portal === 'admin' && <td>{booking.userId}</td>}
                  <td>{machines.find((machine) => machine.id === booking.machineId)?.name ?? booking.machineId}</td>
                  <td>{new Date(booking.startAt).toLocaleString()}</td>
                  <td>{booking.durationMinutes} min</td>
                  <td>{formatMoney(booking.amountCents, booking.currency)}</td>
                  <td><b className="status-pill">{booking.status.replaceAll('_', ' ')}</b></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}
