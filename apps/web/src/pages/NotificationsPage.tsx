import { useEffect } from 'react';
import { PageTitle, ResourceMessage } from '../components/ui';
import { fetchDeliveries } from '../features/paymentsSlice';
import { useAppDispatch, useAppSelector } from '../store';

export function NotificationsPage() {
  const dispatch = useAppDispatch();
  const { deliveries, deliveriesStatus, deliveriesError } = useAppSelector((state) => state.payments);

  useEffect(() => {
    void dispatch(fetchDeliveries());
  }, [dispatch]);

  return (
    <>
      <PageTitle eyebrow="NOTIFICATIONS" title="Email deliveries" />
      <p className="sandbox-note">SMTP test mailbox: Mailhog at http://localhost:8025. These are not production emails.</p>
      {deliveriesStatus === 'loading' && <ResourceMessage kind="loading">Loading deliveries…</ResourceMessage>}
      {deliveriesStatus === 'failed' && (
        <ResourceMessage kind="error">
          {deliveriesError} <button className="text-button" onClick={() => void dispatch(fetchDeliveries())}>Retry</button>
        </ResourceMessage>
      )}
      {deliveriesStatus === 'succeeded' && deliveries.length === 0 && (
        <ResourceMessage kind="empty">No notification deliveries yet.</ResourceMessage>
      )}
      {deliveries.length > 0 && (
        <section className="panel table-wrap">
          <table>
            <thead><tr><th>When</th><th>Event</th><th>Recipient</th><th>Status</th></tr></thead>
            <tbody>{deliveries.map((row) => (
              <tr key={row.id}>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                <td>{row.eventType}</td>
                <td>{row.recipient}</td>
                <td><b className="status-pill">{row.status}</b></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
