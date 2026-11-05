import { useEffect, useState } from 'react';
import { api } from '../api';
import { PageTitle, ResourceMessage, cx } from '../components/ui';
import { fetchBookings } from '../features/bookingsSlice';
import { fetchMachines } from '../features/catalogSlice';
import { fetchUsers } from '../features/identitySlice';
import { useAppDispatch, useAppSelector } from '../store';

export function DashboardPage({ portal }: { portal: 'customer' | 'admin' }) {
  const dispatch = useAppDispatch();
  const [health, setHealth] = useState<'Checking' | 'Online' | 'Offline'>('Checking');
  const [utilization, setUtilization] = useState<{
    day: string;
    venueMinutes: number;
    bookingCount: number;
    freshness: string | null;
    projection: string;
  } | null>(null);
  const { machines, status: catalogStatus } = useAppSelector((state) => state.catalog);
  const { bookings, listStatus } = useAppSelector((state) => state.bookings);
  const { users, usersStatus } = useAppSelector((state) => state.identity);
  const userId = useAppSelector((state) => state.auth.user?.id);
  const visibleBookings = portal === 'admin'
    ? bookings
    : bookings.filter((booking) => booking.userId === userId);

  useEffect(() => {
    void api<{ status: string }>('/health')
      .then(() => setHealth('Online'))
      .catch(() => setHealth('Offline'));
  }, []);

  useEffect(() => {
    void dispatch(fetchMachines());
  }, [dispatch]);

  useEffect(() => {
    if (portal === 'admin') void dispatch(fetchUsers());
  }, [dispatch, portal]);

  useEffect(() => {
    void dispatch(fetchBookings(portal === 'admin' ? undefined : userId));
  }, [dispatch, portal, userId]);

  useEffect(() => {
    if (portal !== 'admin') return;
    void api<{ success: true; data: {
      day: string;
      venueMinutes: number;
      bookingCount: number;
      freshness: string | null;
      projection: string;
    } }>('/api/analytics/utilization')
      .then((body) => {
        if (body.data && !Array.isArray(body.data) && typeof body.data.venueMinutes === 'number') {
          setUtilization(body.data);
        }
      })
      .catch(() => setUtilization(null));
  }, [portal]);

  const statuses = portal === 'admin'
    ? [catalogStatus, usersStatus, listStatus]
    : [catalogStatus, listStatus];
  const loading = statuses.some((status) => status === 'loading' || status === 'idle');
  const failed = statuses.some((status) => status === 'failed');

  return (
    <>
      <PageTitle
        eyebrow={portal === 'admin' ? 'ADMINISTRATION' : 'PLAYER PORTAL'}
        title={portal === 'admin' ? 'Arcade command center' : 'My arcade dashboard'}
      />
      <div className={cx(
        'mb-[22px] grid gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1',
        portal === 'admin' ? 'grid-cols-4' : 'grid-cols-3',
      )}>
        <Stat label="Gateway" value={health} accent />
        {portal === 'admin' && <Stat label="Players" value={loading ? '—' : String(users.length)} />}
        <Stat label="Machines ready" value={loading ? '—' : String(machines.filter((machine) => machine.status === 'ACTIVE').length)} />
        <Stat label={portal === 'admin' ? 'All bookings' : 'My bookings'} value={loading ? '—' : String(visibleBookings.length)} />
      </div>
      {portal === 'admin' && utilization && (
        <p className="mb-5 text-sm leading-6 text-muted">
          Today&apos;s reserved minutes (projection {utilization.projection}): {utilization.venueMinutes}
          {' '}across {utilization.bookingCount} bookings on {utilization.day}.
          Freshness: {utilization.freshness ?? 'no reserved events yet'}.
          PostgreSQL remains the booking source of truth.
        </p>
      )}
      {loading && <ResourceMessage kind="loading">Syncing live platform data…</ResourceMessage>}
      {failed && <ResourceMessage kind="error">Some dashboard data could not be loaded. Open its page to retry.</ResourceMessage>}
      {!loading && !failed && users.length === 0 && machines.length === 0 && bookings.length === 0 && (
        <ResourceMessage kind="empty">No platform activity yet.</ResourceMessage>
      )}
    </>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <article className={cx(
      'flex min-h-28 flex-col justify-between rounded-lg border border-line bg-linear-to-br from-[#1b1d32e6] to-[#0e101ee6] p-5.5',
      accent && 'border-mint/47 shadow-[inset_0_0_28px_#55f8d20b]',
    )}>
      <span className="text-xs uppercase text-muted">{label}</span>
      <strong className="text-[26px]">{value}</strong>
    </article>
  );
}
