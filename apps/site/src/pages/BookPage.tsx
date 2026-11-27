import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CatalogMachine, MachineQuote } from '@arcade/contracts';
import { api } from '../api';
import { useAuth } from '../auth';
import { formatMoney } from '../money';
import { payForBooking } from '../pay';
import { PartyReservation } from './PartyReservation';

type Mode = 'machine' | 'party';

export function BookPage() {
  const { user, token, login, register } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'party' || params.get('package') ? 'party' : 'machine');
  const [machines, setMachines] = useState<CatalogMachine[]>([]);
  const [machineId, setMachineId] = useState(params.get('machine') ?? '');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState(60);
  const [quote, setQuote] = useState<MachineQuote | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [pending, setPending] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    api<CatalogMachine[]>('/api/catalog/machines').then(setMachines).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (mode !== 'machine' || !machineId) {
      setQuote(null);
      return;
    }
    api<MachineQuote>(`/api/catalog/machines/${machineId}/quote?durationMinutes=${duration}`)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [mode, machineId, duration]);

  async function ensureSession(form: FormData) {
    if (user && token) return token;
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    if (authMode === 'register') {
      await register({ email, password, displayName: String(form.get('displayName') ?? '') });
    } else {
      await login({ email, password });
    }
    const saved = localStorage.getItem('arcade.site.token');
    if (!saved) throw new Error('Sign in did not stick');
    return saved;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    setDone('');
    try {
      const session = await ensureSession(form);
      const startAt = new Date(start).toISOString();
      const created = await api<{ id: string }>('/api/booking/bookings', {
        method: 'POST',
        body: JSON.stringify({ machineId, startAt, durationMinutes: duration }),
      }, session);
      await payForBooking(created.id, session);
      setDone('Booking confirmed. Payment received.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Booking failed');
    } finally {
      setPending(false);
    }
  }

  if (mode === 'party') {
    return (
      <div>
        <button type="button" className="mb-4 text-sm text-muted" onClick={() => setMode('machine')}>Book a machine instead</button>
        <PartyReservation />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
      <div>
        <h1 className="font-display text-4xl">Book</h1>
        <div className="mt-5 flex gap-2">
          <button type="button" className={tab(true)}>Machine</button>
          <button type="button" className={tab(false)} onClick={() => setMode('party')}>Party</button>
        </div>
        <div className="mt-6 space-y-4">
          <Select label="Machine" value={machineId} onChange={setMachineId} options={machines.map((machine) => [machine.id, machine.name])} />
          <label className="block text-sm">Start
            <input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className={fieldClass} />
          </label>
          <Select label="Duration" value={String(duration)} onChange={(value) => setDuration(Number(value))} options={[['30', '30 min'], ['60', '60 min'], ['90', '90 min'], ['120', '120 min']]} />
        </div>
      </div>
      <aside className="h-fit space-y-4 rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl">Lane total</h2>
        <p className="font-display text-4xl text-mint">{quote ? formatMoney(quote.amountCents, quote.currency) : '—'}</p>
        {!user && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm text-muted">Sign in or register to hold this booking.</p>
            {authMode === 'register' && <input name="displayName" required placeholder="Name" className={fieldClass} />}
            <input name="email" type="email" required placeholder="Email" className={fieldClass} />
            <input name="password" type="password" required minLength={authMode === 'register' ? 8 : 1} placeholder="Password" className={fieldClass} />
            <button type="button" className="text-sm text-muted" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'Create an account' : 'I already have an account'}
            </button>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {done && <p className="text-sm text-mint">{done} <Link to="/account/bookings" className="underline">My bookings</Link></p>}
        <button type="submit" disabled={pending} className="w-full rounded-full bg-mint py-3 font-semibold text-mint-ink">
          {pending ? 'Booking…' : 'Book and pay'}
        </button>
      </aside>
    </form>
  );
}

const fieldClass = 'mt-1 w-full rounded-2xl border border-line bg-void px-3 py-3';

function tab(active: boolean) {
  return `rounded-full px-4 py-2 text-sm ${active ? 'bg-mint text-mint-ink' : 'border border-line'}`;
}

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-sm">{label}
      <select required={label !== 'Room'} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        <option value="">Choose</option>
        {options.map(([id, name]) => <option key={id || 'none'} value={id}>{name}</option>)}
      </select>
    </label>
  );
}
