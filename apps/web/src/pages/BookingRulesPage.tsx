import { useEffect, useState } from 'react';
import type { BookingRules } from '@arcade/contracts';
import { FormError, errorMessage, onSubmit } from '../components/PackageFields';
import {
  PageTitle,
  ResourceMessage,
  fieldClass,
  inputClass,
  toolbarPrimaryButtonClass,
} from '../components/ui';
import { getBookingRules, saveBookingRules } from '../features/partiesApi';
import { useMenuAccess } from '../features/menuAccess';

const empty: BookingRules = {
  holdMinutes: 10,
  minGuests: 10,
  slotMinutes: 60,
  refundPolicy: '',
};

export function BookingRulesPage() {
  const { canEdit } = useMenuAccess('/admin/booking-rules');
  const [rules, setRules] = useState<BookingRules>(empty);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBookingRules()
      .then((loaded) => {
        if (cancelled) return;
        setRules(loaded);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(errorMessage(loadError, 'Booking rules could not be loaded'));
        setStatus('failed');
      });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      setRules(await saveBookingRules({
        ...rules,
        refundPolicy: rules.refundPolicy.trim(),
      }));
      setSaved(true);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Booking rules could not be saved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="CELEBRATIONS" title="Booking rules" />
      <p className="mb-5 max-w-3xl text-sm leading-6 text-muted">
        These rules drive the customer checkout. The hold is the countdown shown after the guest reviews the party. The refund text is shown beside Process payment.
      </p>
      {status === 'loading' && <ResourceMessage kind="loading">Loading booking rules…</ResourceMessage>}
      {status === 'failed' && !rules.refundPolicy && <ResourceMessage kind="error">{error}</ResourceMessage>}
      {status === 'ready' && (
        <form className="grid max-w-3xl gap-4" onSubmit={onSubmit(save)}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={fieldClass}>
              Hold (minutes) *
              <input className={inputClass} type="number" min={1} max={120} value={rules.holdMinutes} onChange={(event) => setRules({ ...rules, holdMinutes: event.target.valueAsNumber })} required />
            </label>
            <label className={fieldClass}>
              Default minimum guests *
              <input className={inputClass} type="number" min={1} max={500} value={rules.minGuests} onChange={(event) => setRules({ ...rules, minGuests: event.target.valueAsNumber })} required />
            </label>
            <label className={fieldClass}>
              Slot length (minutes) *
              <input className={inputClass} type="number" min={15} max={240} value={rules.slotMinutes} onChange={(event) => setRules({ ...rules, slotMinutes: event.target.valueAsNumber })} required />
            </label>
          </div>
          <label className={fieldClass}>
            Refund policy *
            <textarea className={inputClass} rows={6} value={rules.refundPolicy} onChange={(event) => setRules({ ...rules, refundPolicy: event.target.value })} required />
          </label>
          <FormError message={error} />
          {saved && <p className="m-0 text-sm text-mint">Booking rules saved.</p>}
          {canEdit && (
            <button type="submit" className={toolbarPrimaryButtonClass('px-5')} disabled={saving}>
              {saving ? 'Saving…' : 'Save rules'}
            </button>
          )}
        </form>
      )}
    </>
  );
}
