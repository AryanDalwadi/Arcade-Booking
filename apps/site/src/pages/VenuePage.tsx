import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PartyRoom, Venue, VenueHour } from '@arcade/contracts';
import { api } from '../api';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function VenuePage() {
  const { slug = '' } = useParams();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [hours, setHours] = useState<VenueHour[]>([]);
  const [rooms, setRooms] = useState<PartyRoom[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api<Venue>(`/api/catalog/venues/slug/${encodeURIComponent(slug)}`)
      .then(async (found) => {
        const [hourRows, roomRows] = await Promise.all([
          api<VenueHour[]>(`/api/catalog/venues/${found.id}/hours`),
          api<PartyRoom[]>(`/api/catalog/venues/${found.id}/rooms`),
        ]);
        if (!active) return;
        setVenue(found);
        setHours(hourRows);
        setRooms(roomRows);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => { active = false; };
  }, [slug]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!venue) return <p className="text-muted">Loading venue…</p>;

  return (
    <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-sm text-mint">{venue.city}</p>
        <h1 className="mt-2 font-display text-5xl">{venue.name}</h1>
        <p className="mt-4 text-muted">{venue.description}</p>
        <p className="mt-4">{venue.mall}<br />{venue.address}</p>
        <p className="mt-3 text-sm text-muted">{venue.phone} · {venue.email}</p>
        <Link to={`/book?venue=${venue.id}`} className="mt-6 inline-block rounded-full bg-mint px-5 py-3 font-semibold text-mint-ink">Book this venue</Link>
      </div>
      <aside className="space-y-4">
        <section className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-display text-xl">Hours</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {hours.map((hour) => (
              <li key={hour.dayOfWeek} className="flex justify-between gap-4">
                <span>{days[hour.dayOfWeek]}</span>
                <span className="text-muted">{hour.active ? `${hour.opensAt}–${hour.closesAt}` : 'Closed'}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-display text-xl">Party rooms</h2>
          {rooms.length === 0 && <p className="mt-3 text-sm text-muted">No rooms listed yet.</p>}
          <ul className="mt-3 space-y-2 text-sm">
            {rooms.map((room) => (
              <li key={room.id} className="flex justify-between"><span>{room.name}</span><span className="text-muted">{room.capacity} guests</span></li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
