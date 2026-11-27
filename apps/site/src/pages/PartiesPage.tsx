import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Inclusion, PackageTemplate, PartyType, Venue, VenuePackage } from '@arcade/contracts';
import { api } from '../api';
import { formatMoney } from '../money';

type ShownPackage = {
  code: string;
  name: string;
  description: string;
  pricePerPersonCents: number;
  currency: string;
  minGuests: number;
  maxGuests: number;
  durationMinutes: number;
  inclusionIds: string[];
};

export function PartiesPage() {
  const { code } = useParams();
  const [parties, setParties] = useState<PartyType[]>([]);
  const [defaults, setDefaults] = useState<PackageTemplate[]>([]);
  const [inclusions, setInclusions] = useState<Inclusion[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState('');
  const [venuePackages, setVenuePackages] = useState<VenuePackage[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<PartyType[]>('/api/catalog/party-types'),
      api<PackageTemplate[]>('/api/catalog/package-templates'),
      api<Inclusion[]>('/api/catalog/inclusions'),
      api<Venue[]>('/api/catalog/venues'),
    ]).then(([nextParties, packages, nextInclusions, nextVenues]) => {
      setParties(nextParties);
      setDefaults(packages);
      setInclusions(nextInclusions);
      setVenues(nextVenues);
    }).catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = code ? parties.find((party) => party.code === code) : undefined;
  const locationChoices = selected
    ? venues.filter((venue) => venue.partyTypeIds.includes(selected.id))
    : venues;

  useEffect(() => {
    setVenueId('');
    setVenuePackages(null);
  }, [code]);

  useEffect(() => {
    if (!venueId) {
      setVenuePackages(null);
      return;
    }
    let active = true;
    api<VenuePackage[]>(`/api/catalog/venues/${venueId}/packages`)
      .then((rows) => {
        if (active) setVenuePackages(rows);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => { active = false; };
  }, [venueId]);

  if (loading) return <p className="text-muted">Loading parties…</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (code && !selected) return <p>That party is not available.</p>;

  const packages: ShownPackage[] = venuePackages ?? defaults;
  const venueReady = Boolean(venueId && venuePackages);
  const bookQuery = (packageCode: string) => {
    const search = new URLSearchParams({ mode: 'party', package: packageCode, venue: venueId });
    return `/book?${search.toString()}`;
  };

  return (
    <div>
      <h1 className="font-display text-4xl">{selected ? selected.title : 'Parties'}</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {selected?.description || 'Choose a party, then a venue. Availability and price appear after you select a venue.'}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {parties.map((party) => (
          <Link
            key={party.id}
            to={`/parties/${party.code}`}
            className={`rounded-full px-4 py-2 text-sm ${party.code === code ? 'bg-mint text-mint-ink' : 'border border-line hover:border-mint'}`}
          >
            {party.title}
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel px-5 py-4">
        <label className="text-sm font-semibold" htmlFor="party-location">Book a party at</label>
        <select
          id="party-location"
          value={venueId}
          onChange={(event) => setVenueId(event.target.value)}
          className="min-w-64 flex-1 rounded-xl border border-line bg-void px-3 py-3"
        >
          <option value="">Please select</option>
          {locationChoices.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {[venue.name, venue.city].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
      </div>

      {packages.length === 0 && <p className="mt-8">No packages are listed yet.</p>}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {packages.map((pack) => (
          <article key={pack.code} className="rounded-3xl border border-line bg-panel p-5">
            <p className="font-display text-2xl text-mint">{pack.name}</p>
            <p className="text-sm text-muted">{pack.durationMinutes} min · {pack.minGuests}–{pack.maxGuests} guests</p>
            <ul className="mt-4 space-y-1 text-sm">
              {inclusions.filter((item) => pack.inclusionIds.includes(item.id)).map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
            {venueReady ? (
              <>
                <p className="mt-5 font-display text-3xl">{formatMoney(pack.pricePerPersonCents, pack.currency)}</p>
                <Link to={bookQuery(pack.code)} className="mt-3 inline-block text-mint">Book this package</Link>
              </>
            ) : (
              <p className="mt-5 font-display text-lg leading-snug">Select a venue for availability and price.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
