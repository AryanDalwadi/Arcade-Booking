import { useEffect } from 'react';
import {
  PageTitle,
  ResourceMessage,
  noteClass,
  statusPillClass,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
} from '../components/ui';
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
      <p className={`${noteClass} mb-5`}>SMTP test mailbox: Mailhog at http://localhost:8025. These are not production emails.</p>
      {deliveriesStatus === 'loading' && <ResourceMessage kind="loading">Loading deliveries…</ResourceMessage>}
      {deliveriesStatus === 'failed' && (
        <ResourceMessage kind="error">
          {deliveriesError} <button className={textButtonClass} onClick={() => void dispatch(fetchDeliveries())}>Retry</button>
        </ResourceMessage>
      )}
      {deliveriesStatus === 'succeeded' && deliveries.length === 0 && (
        <ResourceMessage kind="empty">No notification deliveries yet.</ResourceMessage>
      )}
      {deliveries.length > 0 && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead><tr><th className={thClass}>When</th><th className={thClass}>Event</th><th className={thClass}>Recipient</th><th className={thClass}>Status</th></tr></thead>
            <tbody>{deliveries.map((row) => (
              <tr key={row.id} className="hover:bg-white/2">
                <td className={tdClass}>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                <td className={tdClass}>{row.eventType}</td>
                <td className={tdClass}>{row.recipient}</td>
                <td className={tdClass}><b className={statusPillClass}>{row.status}</b></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
