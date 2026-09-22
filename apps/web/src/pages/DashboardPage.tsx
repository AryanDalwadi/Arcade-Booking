import { useEffect, useState } from 'react';
import { api } from '../api';
import { PageTitle, ResourceMessage } from '../components/ui';
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
      <div className="stats">
        <Stat label="Gateway" value={health} accent />
        {portal === 'admin' && <Stat label="Players" value={loading ? '—' : String(users.length)} />}
        <Stat label="Machines ready" value={loading ? '—' : String(machines.filter((machine) => machine.status === 'ACTIVE').length)} />
        <Stat label={portal === 'admin' ? 'All bookings' : 'My bookings'} value={loading ? '—' : String(visibleBookings.length)} />
      </div>
      {portal === 'admin' && utilization && (
        <p>
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
  return <article className={`stat ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong></article>;
}
