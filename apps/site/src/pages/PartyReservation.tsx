import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { BookingRules, Inclusion, PackageTemplate, Venue, VenueBlackout, VenueHour, VenuePackage } from '@arcade/contracts';

const partyStartClocks = ['11:00', '15:00', '19:00'] as const;
import { api } from '../api';
import { useAuth } from '../auth';
import { formatMoney } from '../money';
import { payForBooking } from '../pay';

const contactKey = 'arcade.site.partyContact';
const gateway = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:4000';
const liveHoldIds = new Set<string>();
type Step = 'choose' | 'info' | 'review';
type PartyHold = { id: string; token: string; expiresAt: string };

type Pack = PackageTemplate | VenuePackage;

export function PartyReservation() {
  const { user, token, login, register } = useAuth();
  const [params] = useSearchParams();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [inclusions, setInclusions] = useState<Inclusion[]>([]);
  const [defaults, setDefaults] = useState<PackageTemplate[]>([]);
  const [packages, setPackages] = useState<Pack[]>([]);
  const [hours, setHours] = useState<VenueHour[]>([]);
  const [blackouts, setBlackouts] = useState<VenueBlackout[]>([]);
  const [venueId, setVenueId] = useState(params.get('venue') ?? '');
  const [packageCode, setPackageCode] = useState(params.get('package') ?? '');
  const [guests, setGuests] = useState(0);
  const [cursor, setCursor] = useState(() => new Date());
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [honorName, setHonorName] = useState('');
  const [honorAge, setHonorAge] = useState('');
  const [notes, setNotes] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [step, setStep] = useState<Step>('choose');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deals, setDeals] = useState(false);
  const [remember, setRemember] = useState(false);
  const [arriveEarly, setArriveEarly] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [refundPolicy, setRefundPolicy] = useState('');
  const [holdSeconds, setHoldSeconds] = useState(10 * 60);
  const [hold, setHold] = useState<PartyHold | null>(null);
  const [reserving, setReserving] = useState(false);
  const [slotState, setSlotState] = useState<Record<string, 'open' | 'held' | 'booked'>>({});
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [heldBookingId, setHeldBookingId] = useState('');
  const payingRef = useRef(false);
  const claimedRef = useRef(false);
  payingRef.current = paying;
  const [password, setPassword] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountName, setAccountName] = useState('');
  const [askAuth, setAskAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);

  useEffect(() => {
    Promise.all([
      api<Venue[]>('/api/catalog/venues'),
      api<Inclusion[]>('/api/catalog/inclusions'),
      api<PackageTemplate[]>('/api/catalog/package-templates'),
    ]).then(([nextVenues, nextInclusions, nextDefaults]) => {
      setVenues(nextVenues);
      setInclusions(nextInclusions);
      setDefaults(nextDefaults);
    }).catch((reason: Error) => setError(reason.message));
    api<BookingRules>('/api/catalog/booking-rules')
      .then((rules) => setRefundPolicy(rules.refundPolicy))
      .catch(() => undefined);
    const saved = readContact();
    if (saved) {
      setFirstName(saved.firstName);
      setLastName(saved.lastName);
      setPhone(saved.phone);
      setEmail(saved.email);
      setDeals(saved.deals);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (step !== 'review' || !hold) return;
    const tick = () => setHoldSeconds(Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [step, hold]);

  useEffect(() => {
    if (!hold) return;
    liveHoldIds.add(hold.id);
    const current = hold;
    const releaseOnHide = () => {
      if (payingRef.current || claimedRef.current || !liveHoldIds.has(current.id)) return;
      liveHoldIds.delete(current.id);
      void releasePartyHold(current);
    };
    window.addEventListener('pagehide', releaseOnHide);
    return () => {
      window.removeEventListener('pagehide', releaseOnHide);
      liveHoldIds.delete(current.id);
      window.setTimeout(() => {
        if (liveHoldIds.has(current.id) || claimedRef.current) return;
        void releasePartyHold(current);
      }, 400);
    };
  }, [hold]);

  useEffect(() => {
    if (step === 'review' && holdSeconds === 0) {
      setAskAuth(false);
      setError('This reservation time ran out. Go back and choose the time again.');
    }
  }, [step, holdSeconds]);

  useEffect(() => {
    if (!venueId) {
      setPackages(defaults);
      setHours([]);
      setBlackouts([]);
      return;
    }
    Promise.all([
      api<VenuePackage[]>(`/api/catalog/venues/${venueId}/packages`),
      api<VenueHour[]>(`/api/catalog/venues/${venueId}/hours`),
      api<VenueBlackout[]>(`/api/catalog/venues/${venueId}/blackouts`),
    ]).then(([nextPackages, nextHours, nextBlackouts]) => {
      setPackages(nextPackages);
      setHours(nextHours);
      setBlackouts(nextBlackouts);
      setPackageCode((current) => current && nextPackages.some((item) => item.code === current) ? current : nextPackages[0]?.code ?? '');
    }).catch((reason: Error) => setError(reason.message));
  }, [venueId, defaults]);

  const selected = packages.find((item) => item.code === packageCode) ?? null;
  const venue = venues.find((item) => item.id === venueId);

  useEffect(() => {
    if (!selected) return;
    setGuests((current) => current >= selected.minGuests && current <= selected.maxGuests ? current : selected.minGuests);
    setTime('');
  }, [selected]);

  const guestChoices = useMemo(() => {
    if (!selected) return [];
    return Array.from({ length: selected.maxGuests - selected.minGuests + 1 }, (_, index) => selected.minGuests + index);
  }, [selected]);

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const now = useMemo(() => venueClock(venue?.timezone || 'Asia/Kolkata', nowTick), [venue?.timezone, nowTick]);
  const blackoutDays = useMemo(() => new Set(blackouts.map((item) => item.blackoutDate)), [blackouts]);
  const closedDays = useMemo(() => {
    const days = new Set(blackoutDays);
    if (!selected || hours.length === 0) return days;
    const weekday = new Date(`${now.date}T12:00:00`).getDay();
    const hour = hours.find((item) => item.dayOfWeek === weekday && item.active);
    const open = hour ? clockMinutes(hour.opensAt) : 0;
    const close = hour ? clockMinutes(hour.closesAt) : 0;
    const stillOpen = Boolean(hour) && partyStartClocks.some((clock) => {
      const start = clockMinutes(clock);
      return start > now.minutes && start >= open && start + selected.durationMinutes <= close;
    });
    if (!stillOpen) days.add(now.date);
    return days;
  }, [blackoutDays, selected, hours, now]);
  const times = useMemo(() => {
    if (!selected || !day) return [];
    const weekday = new Date(`${day}T12:00:00`).getDay();
    const hour = hours.find((item) => item.dayOfWeek === weekday && item.active);
    if (!hour) return [];
    const open = clockMinutes(hour.opensAt);
    const close = clockMinutes(hour.closesAt);
    return partyStartClocks.filter((clock) => {
      const start = clockMinutes(clock);
      return start >= open && start + selected.durationMinutes <= close;
    });
  }, [selected, day, hours]);

  useEffect(() => {
    if (day && (day < now.date || closedDays.has(day))) {
      setDay('');
      setTime('');
    } else if (time && day === now.date && clockMinutes(time) <= now.minutes) {
      setTime('');
    }
  }, [day, time, now, closedDays]);

  useEffect(() => {
    if (!venueId || !day || step !== 'choose') {
      return;
    }
    let cancelled = false;
    const load = () => {
      api<{ slots: Array<{ clock: string; state: 'open' | 'held' | 'booked' }> }>(`/api/booking/party-slots?venueId=${venueId}&date=${day}`)
        .then((data) => {
          if (!cancelled) setSlotState(Object.fromEntries(data.slots.map((slot) => [slot.clock, slot.state])));
        })
        .catch(() => {
          if (!cancelled) setSlotState({});
        });
    };
    load();
    const timer = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [venueId, day, step]);

  const total = selected ? selected.pricePerPersonCents * guests : 0;
  const inclusionNames = inclusions.filter((item) => selected?.inclusionIds.includes(item.id));

  function openInformation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !venue || !day || time === '') return;
    if (!email && user?.email) setEmail(user.email);
    if (!firstName && user?.displayName) {
      const [first, ...rest] = user.displayName.split(' ');
      setFirstName(first ?? '');
      if (!lastName) setLastName(rest.join(' '));
    }
    setStep('info');
  }

  async function openReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !venue || !day || !time || reserving) return;
    if (remember) {
      localStorage.setItem(contactKey, JSON.stringify({ firstName, lastName, phone, email, deals }));
    } else {
      localStorage.removeItem(contactKey);
    }
    setError('');
    setReserving(true);
    try {
      const created = await api<PartyHold>('/api/booking/party-holds', {
        method: 'POST',
        body: JSON.stringify({
          venueId: venue.id,
          packageCode: selected.code,
          guestCount: guests,
          startAt: zonedStart(day, time, venue.timezone || 'Asia/Kolkata'),
          ...(email ? { customerEmail: email } : {}),
        }),
      });
      claimedRef.current = false;
      setHeldBookingId('');
      setHold(created);
      setHoldSeconds(Math.max(0, Math.ceil((Date.parse(created.expiresAt) - Date.now()) / 1000)));
      setStep('review');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That time could not be held.');
    } finally {
      setReserving(false);
    }
  }

  async function backFromReview() {
    const current = hold;
    claimedRef.current = false;
    if (current) {
      liveHoldIds.delete(current.id);
      setHold(null);
      await releasePartyHold(current);
    }
    setError('');
    setStep('info');
  }

  async function openPayment(event?: FormEvent) {
    event?.preventDefault();
    if (holdSeconds <= 0) {
      setAskAuth(false);
      setError('This reservation time ran out. Go back and choose the time again.');
      return;
    }
    if (!acceptTerms) {
      setError('Accept the terms and refund policy before payment.');
      return;
    }
    if (!selected || !venue || !day || !time || guests < 1) return;
    if (paying || paid) return;
    const fromPopup = event?.currentTarget instanceof HTMLFormElement;
    if (!token && !fromPopup) {
      setAuthMode((mode) => mode ?? 'login');
      setAccountEmail((current) => current || email);
      setAccountName((current) => current || `${firstName} ${lastName}`.trim());
      setAskAuth(true);
      setError('');
      return;
    }
    setPaying(true);
    setError('');
    try {
      const session = await ensureSession();
      setAskAuth(false);
      const bookingId = heldBookingId || await claimHold(session);
      await payForBooking(bookingId, session, {
        name: `${firstName} ${lastName}`.trim(),
        email,
        contact: phone,
        description: `${selected.name} party at ${venue.name}`,
      });
      setPaid(true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Payment failed';
      setError(message === 'Checkout closed' ? 'Payment window closed. You can open it again.' : message);
    } finally {
      setPaying(false);
    }
  }

  async function ensureSession() {
    if (token) return token;
    if (!authMode || !accountEmail || !password) throw new Error('Enter your email and password.');
    if (authMode === 'register') {
      const displayName = accountName.trim();
      if (!displayName) throw new Error('Enter your user name.');
      await register({ email: accountEmail, password, displayName });
    } else {
      await login({ email: accountEmail, password });
    }
    const saved = localStorage.getItem('arcade.site.token');
    if (!saved) throw new Error('Sign in did not stick');
    return saved;
  }

  async function claimHold(session: string) {
    if (!hold || holdSeconds <= 0) throw new Error('This reservation time ran out. Go back and choose the time again.');
    const created = await api<{ id: string }>(`/api/booking/party-holds/${hold.id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ token: hold.token }),
    }, session);
    claimedRef.current = true;
    setHeldBookingId(created.id);
    return created.id;
  }

  if (step === 'info') {
    return (
      <form onSubmit={openReview} className="mx-auto max-w-3xl rounded-3xl border border-line bg-panel p-6 md:p-8">
        <h1 className="font-display text-4xl">Your information</h1>
        <p className="mt-3 text-sm text-muted">Please enter your contact information. An email address is required for a confirmation receipt. You will review the reservation on the next page.</p>
        <div className="mt-6 space-y-4 border-t border-line pt-6">
          <ContactField label="First name" value={firstName} onChange={setFirstName} required />
          <ContactField label="Last name" value={lastName} onChange={setLastName} required />
          <ContactField label="Phone number" value={phone} onChange={setPhone} required />
          <ContactField label="E-mail" value={email} onChange={setEmail} type="email" required />
        </div>
        <label className="mt-6 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={deals} onChange={(event) => setDeals(event.target.checked)} className="mt-1" />
          <span>Yes! I want to receive exclusive deals and promotions via SMS, WhatsApp or email. I understand that I can opt out at any time.</span>
        </label>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="mt-1" />
          <span>Remember me to make my next booking faster.<br /><span className="text-muted">This data is stored locally on your own device.</span></span>
        </label>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex justify-between border-t border-line pt-6">
          <button type="button" onClick={() => { setError(''); setStep('choose'); }} className="rounded-full bg-mint px-5 py-3 font-semibold text-mint-ink">Back</button>
          <button type="submit" disabled={reserving} className="rounded-full bg-mint px-5 py-3 font-semibold text-mint-ink">{reserving ? 'Holding this time…' : 'Continue'}</button>
        </div>
      </form>
    );
  }

  if (step === 'review' && selected && venue) {
    const end = minutesClock(clockMinutes(time) + selected.durationMinutes);
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <p className="rounded-2xl border border-line bg-panel px-4 py-3 text-center text-sm">
          Please note that you have <span className="font-display text-mint">{formatHold(holdSeconds)}</span> minutes to complete the reservation.
        </p>
        <div className="rounded-3xl border border-line bg-panel p-6 md:p-8">
          <h1 className="font-display text-4xl">Hello {firstName},</h1>
          <p className="mt-3 text-sm text-muted">Review your reservation below, then continue to payment. A confirmation will use <span className="text-ink">{email}</span>.</p>
          <h2 className="mt-8 font-display text-xl">Customer details</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-muted">Name</dt><dd>{firstName} {lastName}</dd>
            <dt className="text-muted">Phone number</dt><dd>{phone}</dd>
            <dt className="text-muted">E-mail</dt><dd>{email}</dd>
          </dl>
          <h2 className="mt-8 font-display text-xl">Reservation information</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-muted">Where</dt>
            <dd>
              <span className="font-semibold">{venue.name}</span>
              <br />{[venue.mall, venue.address, venue.city].filter(Boolean).join(', ')}
            </dd>
            <dt className="text-muted">Date</dt><dd className="font-semibold">{longDate(day)}</dd>
            <dt className="text-muted">Time</dt><dd className="font-semibold">{clockLabel(time)} - {clockLabel(end)}</dd>
            <dt className="text-muted">Party details</dt><dd className="font-semibold">{guests} x {selected.name}</dd>
            {honorName && <><dt className="text-muted">Guest of honor</dt><dd>{honorName}{honorAge ? `, age ${honorAge}` : ''}</dd></>}
          </dl>
          {refundPolicy && (
            <div className="mt-8">
              <h2 className="font-display text-xl">Refund policy</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{refundPolicy}</p>
            </div>
          )}
          <label className="mt-6 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={arriveEarly} onChange={(event) => setArriveEarly(event.target.checked)} className="mt-1" />
            <span>To ensure your group has the best experience please arrive 10–15 minutes prior to your requested start time.</span>
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-1" />
            <span>I accept the privacy policy, terms and conditions, and refund policy.</span>
          </label>
          {error && !askAuth && <p className="mt-4 text-sm text-danger">{error}</p>}
          {paid && <p className="mt-4 text-sm text-mint">Payment received. <Link to="/account/bookings" className="underline">My bookings</Link></p>}
          <div className="mt-8 flex flex-col items-center gap-4">
            {!paid && (
              <button type="button" disabled={paying || holdSeconds <= 0} onClick={() => void openPayment()} className="rounded-full bg-mint px-6 py-3 font-semibold text-mint-ink">
                {paying ? 'Opening Razorpay…' : holdSeconds <= 0 ? 'Time ran out' : 'Proceed to payment'}
              </button>
            )}
            {!paid && <button type="button" onClick={() => void backFromReview()} className="text-sm text-muted underline">Back</button>}
          </div>
          {askAuth && !token && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="pay-login-title">
              <form onSubmit={openPayment} className="w-full max-w-md rounded-3xl border border-line bg-panel p-6">
                <div className="flex items-start justify-between gap-4">
                  <h2 id="pay-login-title" className="font-display text-3xl">{authMode === 'register' ? 'Sign up' : 'Log in'}</h2>
                  <button type="button" onClick={() => { setAskAuth(false); setPassword(''); setError(''); }} className="text-sm text-muted" aria-label="Close">Close</button>
                </div>
                <p className="mt-2 text-sm">Time left to pay: <span className="font-display text-mint">{formatHold(holdSeconds)}</span></p>
                <div className="mt-5 space-y-3">
                  {authMode === 'register' && (
                    <label className="block text-sm">User name
                      <input value={accountName} onChange={(event) => setAccountName(event.target.value)} autoComplete="name" required className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-3" />
                    </label>
                  )}
                  <label className="block text-sm">Email
                    <input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} autoComplete="email" required className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-3" />
                  </label>
                  <label className="block text-sm">Password
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 8 : 1} required className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-3" />
                  </label>
                </div>
                {error && <p className="mt-3 text-sm text-danger">{error}</p>}
                <button type="submit" disabled={paying || holdSeconds <= 0} className="mt-5 w-full rounded-full bg-mint py-3 font-semibold text-mint-ink">
                  {holdSeconds <= 0 ? 'Time ran out' : paying ? 'Opening Razorpay…' : authMode === 'register' ? 'Sign up and pay' : 'Log in and pay'}
                </button>
                <button type="button" className="mt-4 text-sm text-muted underline" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setError(''); }}>
                  {authMode === 'register' ? 'I already have an account' : 'Create an account'}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={openInformation} className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-8 rounded-3xl border border-line bg-panel p-5 md:p-7">
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">Book a party at</span>
          <select value={venueId} onChange={(event) => { setVenueId(event.target.value); setDay(''); setTime(''); }} className="min-w-56 flex-1 rounded-xl border border-line bg-void px-3 py-3" required>
            <option value="">Please select</option>
            {venues.map((item) => (
              <option key={item.id} value={item.id}>{[item.name, item.city].filter(Boolean).join(' · ')}</option>
            ))}
          </select>
        </label>

        <section>
          <h1 className="font-display text-2xl">Please start by selecting your package</h1>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {packages.map((pack) => {
              const active = pack.code === packageCode;
              return (
                <button key={pack.code} type="button" onClick={() => setPackageCode(pack.code)} className={`rounded-2xl border p-4 text-left ${active ? 'border-mint bg-void' : 'border-line'}`}>
                  <p className="font-display text-xl text-mint">{pack.name}</p>
                  <p className="mt-2 font-display text-3xl">{formatMoney(pack.pricePerPersonCents, pack.currency)}</p>
                  <p className="text-xs text-muted">per guest · {pack.durationMinutes} min</p>
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {inclusions.filter((item) => pack.inclusionIds.includes(item.id)).map((item) => <li key={item.id}>{item.name}</li>)}
                  </ul>
                </button>
              );
            })}
          </div>
        </section>

        {selected && (
          <section>
            <h2 className="font-display text-xl">Number of guests</h2>
            <p className="mt-1 text-sm text-muted">Include everyone attending. This package is for {selected.minGuests} to {selected.maxGuests} guests.</p>
            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {guestChoices.map((count) => (
                <button key={count} type="button" onClick={() => setGuests(count)} className={`rounded-lg py-2 text-sm font-semibold ${count === guests ? 'bg-mint text-mint-ink' : 'border border-line'}`}>
                  {count}
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl">What date would you like to reserve?</h2>
          <MonthCalendar
            cursor={cursor}
            selected={day}
            blocked={closedDays}
            today={now.date}
            onCursor={setCursor}
            onSelect={(value) => { setDay(value); setTime(''); }}
          />
          {day && <p className="mt-3 text-sm">Selected date: {displayDay(day)}</p>}
        </section>

        <section>
          <h2 className="font-display text-xl">Available times</h2>
          {!day && <p className="mt-2 text-sm text-muted">Choose a date to see start times.</p>}
          {day && times.length === 0 && <p className="mt-2 text-sm text-muted">The venue is closed that day, or the package does not fit the hours.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {times.map((slot) => {
              const state = slotState[slot] ?? 'open';
              const passed = day === now.date && clockMinutes(slot) <= now.minutes;
              const blocked = passed || state !== 'open';
              return (
                <button key={slot} type="button" disabled={blocked} onClick={() => setTime(slot)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${time === slot ? 'bg-mint text-mint-ink' : 'border border-line'} ${blocked ? 'text-muted' : ''}`}>
                  {clockLabel(slot)}{state === 'booked' ? ' · booked' : ''}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="font-display text-xl md:col-span-2">Guest of honor</h2>
          <label className="text-sm">Name
            <input value={honorName} onChange={(event) => setHonorName(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-3" />
          </label>
          <label className="text-sm">Age
            <select value={honorAge} onChange={(event) => setHonorAge(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-3">
              <option value="">Choose</option>
              {Array.from({ length: 18 }, (_, age) => age + 1).map((age) => <option key={age} value={age}>{age}</option>)}
            </select>
          </label>
        </section>

        <label className="block text-sm">Additional information
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Allergies, access, or other notes" className="mt-1 w-full rounded-xl border border-line bg-void px-3 py-3" />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={!selected || !day || !time} className="rounded-full bg-mint px-6 py-3 font-semibold text-mint-ink">
            Continue
          </button>
        </div>
      </div>

      <aside className="rounded-3xl border border-line bg-panel p-5 lg:sticky lg:top-6">
        <h2 className="font-display text-2xl">Your reservation</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-muted">Package</dt>
            <dd className="mt-1 font-semibold">{selected?.name ?? '—'}</dd>
            {detailsOpen && selected && (
              <dd className="mt-2 space-y-1 text-muted">
                <p>{selected.durationMinutes} minutes</p>
                {inclusionNames.map((item) => <p key={item.id}>{item.name}</p>)}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-muted">Date</dt>
            <dd>{day ? displayDay(day) : '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Guests</dt>
            <dd>{guests || '—'}</dd>
          </div>
          {honorName && <div><dt className="text-muted">Guest of honor</dt><dd>{honorName}{honorAge ? `, age ${honorAge}` : ''}</dd></div>}
          {notes && <div><dt className="text-muted">Notes</dt><dd>{notes}</dd></div>}
          <div className="flex justify-between border-t border-line pt-3">
            <span>Package</span>
            <span>{selected ? formatMoney(total, selected.currency) : '—'}</span>
          </div>
          <div className="flex justify-between font-display text-xl">
            <span>Total price</span>
            <span className="text-mint">{selected ? formatMoney(total, selected.currency) : '—'}</span>
          </div>
        </dl>
        <button type="button" className="mt-4 text-sm text-muted" onClick={() => setDetailsOpen((open) => !open)}>
          {detailsOpen ? 'Close detailed total' : 'Show detailed total'}
        </button>
      </aside>
    </form>
  );
}

function ContactField({ label, value, onChange, type = 'text', required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid items-center gap-3 text-sm sm:grid-cols-[140px_1fr]">
      <span className="font-semibold">{label}</span>
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-line bg-void px-3 py-3" />
    </label>
  );
}

function readContact(): { firstName: string; lastName: string; phone: string; email: string; deals: boolean } | null {
  try {
    const raw = localStorage.getItem(contactKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<{ firstName: string; lastName: string; phone: string; email: string; deals: boolean }>;
    if (!value.email) return null;
    return {
      firstName: value.firstName ?? '',
      lastName: value.lastName ?? '',
      phone: value.phone ?? '',
      email: value.email,
      deals: Boolean(value.deals),
    };
  } catch {
    return null;
  }
}

function releasePartyHold(current: PartyHold) {
  return fetch(`${gateway}/api/booking/party-holds/${current.id}/release`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: current.token }),
    keepalive: true,
  }).catch(() => undefined);
}

function formatHold(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function longDate(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(year ?? 0, (month ?? 1) - 1, date ?? 1);
  const dayNumber = value.getDate();
  const suffix = dayNumber % 10 === 1 && dayNumber !== 11 ? 'st'
    : dayNumber % 10 === 2 && dayNumber !== 12 ? 'nd'
      : dayNumber % 10 === 3 && dayNumber !== 13 ? 'rd'
        : 'th';
  return `${value.toLocaleString('en-US', { month: 'long' })} ${dayNumber}${suffix}`;
}

function MonthCalendar({ cursor, selected, blocked, today, onCursor, onSelect }: {
  cursor: Date;
  selected: string;
  blocked: Set<string>;
  today: string;
  onCursor: (date: Date) => void;
  onSelect: (day: string) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [...Array.from({ length: first }, () => ''), ...Array.from({ length: count }, (_, index) => String(index + 1))];

  return (
    <div className="mt-4 max-w-md">
      <div className="flex items-center justify-between">
        <button type="button" className="px-3 py-1" onClick={() => onCursor(new Date(year, month - 1, 1))} aria-label="Previous month">‹</button>
        <p className="font-display tracking-wide">{cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</p>
        <button type="button" className="px-3 py-1" onClick={() => onCursor(new Date(year, month + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center text-sm">
        {cells.map((cell, index) => {
          if (!cell) return <span key={`empty-${index}`} />;
          const value = `${year}-${String(month + 1).padStart(2, '0')}-${cell.padStart(2, '0')}`;
          const disabled = value < today || blocked.has(value);
          const active = value === selected;
          return (
            <button key={value} type="button" disabled={disabled} onClick={() => onSelect(value)} className={`rounded-lg py-2 ${active ? 'bg-mint font-semibold text-mint-ink' : disabled ? 'text-line' : 'hover:bg-void'}`}>
              {cell}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function venueClock(timeZone: string, instant: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instant));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';
  const hour = Number(read('hour')) % 24;
  const minute = Number(read('minute'));
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    minutes: hour * 60 + minute,
  };
}

function clockMinutes(clock: string) {
  const [hour, minute] = clock.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function minutesClock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function zonedStart(day: string, clock: string, timeZone: string) {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = clock.split(':').map(Number);
  const guess = Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, hour ?? 0, minute ?? 0);
  const offset = zoneOffset(new Date(guess), timeZone);
  return new Date(guess - offset).toISOString();
}

function zoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
  return asUtc - date.getTime();
}

function clockLabel(clock: string) {
  const minutes = clockMinutes(clock);
  const hour = Math.floor(minutes / 60);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const shown = hour % 12 || 12;
  return `${shown}:${String(minutes % 60).padStart(2, '0')}${suffix}`;
}

function displayDay(day: string) {
  const [year, month, date] = day.split('-');
  return `${month}/${date}/${year}`;
}

