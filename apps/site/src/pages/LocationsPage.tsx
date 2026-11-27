import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Venue } from '@arcade/contracts';
import { api } from '../api';

export function LocationsPage() {
  const [params, setParams] = useSearchParams();
  const city = params.get('city') ?? '';
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Venue[]>('/api/catalog/venues')
      .then(setVenues)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const cities = [...new Set((venues ?? []).map((venue) => venue.city).filter(Boolean))];
  const shown = (venues ?? []).filter((venue) => !city || venue.city === city);

  return (
    <div>
      <h1 className="font-display text-4xl">Locations</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={chip(city === '')} onClick={() => setParams({})}>All</button>
        {cities.map((name) => (
          <button key={name} type="button" className={chip(city === name)} onClick={() => setParams({ city: name })}>{name}</button>
        ))}
      </div>
      {error && <p className="mt-6 text-danger">{error}</p>}
      {venues && shown.length === 0 && <p className="mt-6">No venues are open yet.</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {shown.map((venue) => (
          <Link key={venue.id} to={`/locations/${venue.slug}`} className="rounded-3xl border border-line bg-panel p-5 hover:border-mint">
            <p className="text-sm text-mint">{venue.city}</p>
            <h2 className="mt-1 font-display text-2xl">{venue.name}</h2>
            <p className="mt-2 text-sm text-muted">{[venue.mall, venue.address].filter(Boolean).join(' · ')}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-full px-4 py-2 text-sm ${active ? 'bg-mint text-mint-ink' : 'border border-line text-muted'}`;
}
