import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogMachine } from '@arcade/contracts';
import { api } from '../api';
import { formatMoney } from '../money';

export function GamesPage() {
  const [machines, setMachines] = useState<CatalogMachine[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<CatalogMachine[]>('/api/catalog/machines')
      .then(setMachines)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <div>
      <h1 className="font-display text-4xl">Games</h1>
      <p className="mt-3 text-muted">Active machines and the hourly price used when you book a lane.</p>
      {error && <p className="mt-6 text-danger">{error}</p>}
      {machines && machines.length === 0 && <p className="mt-6">No games are on the floor yet.</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(machines ?? []).map((machine) => (
          <article key={machine.id} className="rounded-3xl border border-line bg-panel p-5">
            <h2 className="font-display text-2xl">{machine.name}</h2>
            <p className="mt-2 text-mint">
              {machine.pricePerHourCents == null ? 'Price on request' : `${formatMoney(machine.pricePerHourCents, machine.currency ?? 'INR')} / hour`}
            </p>
            <Link to={`/book?machine=${machine.id}`} className="mt-4 inline-block text-sm text-ink underline">Book this machine</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
