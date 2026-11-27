import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Venue } from '@arcade/contracts';
import { api } from '../api';

export function HomePage() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Venue[]>('/api/catalog/venues')
      .then(setVenues)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const cities = [...new Set((venues ?? []).map((venue) => venue.city).filter(Boolean))];

  return (
    <div className="space-y-12">
      <section className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.25em] text-mint">Arcade booking</p>
          <h1 className="mt-3 font-display text-5xl leading-none md:text-7xl">Play first. Party louder.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Pick a venue, grab a machine, or book a birthday package. The floor, the price, and the time come from the live catalog.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/book" className="rounded-full bg-mint px-5 py-3 font-semibold text-mint-ink">Book now</Link>
            <Link to="/locations" className="rounded-full border border-line px-5 py-3">Find a venue</Link>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-panel p-6">
          <p className="text-sm text-muted">Open cities</p>
          {error && <p className="mt-3 text-danger">{error}</p>}
          {venues && cities.length === 0 && <p className="mt-3">No venues are open yet.</p>}
          <ul className="mt-4 space-y-3">
            {cities.map((city) => (
              <li key={city}>
                <Link to={`/locations?city=${encodeURIComponent(city)}`} className="font-display text-2xl hover:text-mint">{city}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {(venues ?? []).slice(0, 3).map((venue) => (
          <Link key={venue.id} to={`/locations/${venue.slug}`} className="rounded-3xl border border-line bg-panel p-5 hover:border-mint">
            <p className="text-sm text-mint">{venue.city}</p>
            <h2 className="mt-2 font-display text-2xl">{venue.name}</h2>
            <p className="mt-2 text-sm text-muted">{venue.mall}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
