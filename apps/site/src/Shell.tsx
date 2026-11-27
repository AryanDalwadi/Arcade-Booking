import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import type { PartyType } from '@arcade/contracts';
import { api } from './api';
import { useAuth } from './auth';

const links = [
  ['/games', 'Games'],
  ['/locations', 'Locations'],
  ['/book', 'Book'],
] as const;

export function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [parties, setParties] = useState<PartyType[]>([]);
  const [open, setOpen] = useState(false);
  const onParties = location.pathname.startsWith('/parties');

  useEffect(() => {
    api<PartyType[]>('/api/catalog/party-types').then(setParties).catch(() => setParties([]));
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-void/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <Link to="/" className="font-display text-xl tracking-wide text-mint">Neon Arcade</Link>
          <nav className="flex flex-1 items-center gap-4 text-sm text-muted">
            <div className="relative">
              <button
                type="button"
                aria-expanded={open}
                className={onParties || open ? 'text-ink' : 'hover:text-ink'}
                onClick={() => setOpen((current) => !current)}
              >
                Parties
              </button>
              {open && (
                <div className="absolute top-full left-0 z-20 mt-3 min-w-52 rounded-xl border border-line bg-panel py-2 shadow-xl">
                  {parties.length === 0 && <p className="px-4 py-2 text-muted">No parties yet</p>}
                  {parties.map((party) => (
                    <Link
                      key={party.id}
                      to={`/parties/${party.code}`}
                      className="block px-4 py-2 text-ink hover:bg-void hover:text-mint"
                    >
                      {party.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'text-ink' : 'hover:text-ink'}>
                {label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <Link to="/account/bookings" className="text-ink">{user.displayName}</Link>
              <button type="button" className="text-muted hover:text-ink" onClick={logout}>Sign out</button>
            </div>
          ) : (
            <Link to="/login" className="rounded-full bg-mint px-4 py-2 text-sm font-semibold text-mint-ink">Sign in</Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted">
        Play, party, and book a lane at Neon Arcade.
      </footer>
    </div>
  );
}
