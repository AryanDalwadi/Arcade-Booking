import { type FormEvent } from 'react';
import type { Inclusion, PackageTemplate, VenuePackage } from '@arcade/contracts';
import { ApiError } from '../api';
import { centsFromRupees, rupeesFromCents } from '../features/partiesApi';
import { CheckboxField, errorClass, fieldClass, inputClass, Select } from './ui';

export type PackageDraft = {
  description: string;
  priceRupees: string;
  currency: string;
  minGuests: number;
  maxGuests: number;
  durationMinutes: number;
  active: boolean;
  inclusionIds: string[];
};

export function draftFromPackage(pkg: Pick<PackageTemplate | VenuePackage, 'description' | 'pricePerPersonCents' | 'currency' | 'minGuests' | 'maxGuests' | 'durationMinutes' | 'active' | 'inclusionIds'>): PackageDraft {
  return {
    description: pkg.description,
    priceRupees: rupeesFromCents(pkg.pricePerPersonCents),
    currency: pkg.currency,
    minGuests: pkg.minGuests,
    maxGuests: pkg.maxGuests,
    durationMinutes: pkg.durationMinutes,
    active: pkg.active,
    inclusionIds: pkg.inclusionIds,
  };
}

export function payloadFromDraft(draft: PackageDraft) {
  const pricePerPersonCents = centsFromRupees(draft.priceRupees);
  if (pricePerPersonCents === null) return 'Enter a price of zero or more';
  if (draft.maxGuests < draft.minGuests) return 'Maximum guests must be at least the minimum';
  return {
    description: draft.description.trim(),
    pricePerPersonCents,
    currency: draft.currency.trim().toUpperCase(),
    minGuests: draft.minGuests,
    maxGuests: draft.maxGuests,
    durationMinutes: draft.durationMinutes,
    active: draft.active,
    inclusionIds: draft.inclusionIds,
  };
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function PackageFields({
  draft,
  inclusions,
  onChange,
}: {
  draft: PackageDraft;
  inclusions: Inclusion[];
  onChange: (draft: PackageDraft) => void;
}) {
  function toggleInclusion(id: string, checked: boolean) {
    onChange({
      ...draft,
      inclusionIds: checked
        ? [...draft.inclusionIds, id]
        : draft.inclusionIds.filter((current) => current !== id),
    });
  }

  return (
    <div className="grid gap-4">
      <label className={fieldClass}>
        Description
        <textarea className={inputClass} rows={3} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={fieldClass}>
          Price per person (₹) *
          <input className={inputClass} inputMode="decimal" value={draft.priceRupees} onChange={(event) => onChange({ ...draft, priceRupees: event.target.value })} required />
        </label>
        <label className={fieldClass}>
          Currency *
          <input className={inputClass} value={draft.currency} minLength={3} maxLength={3} onChange={(event) => onChange({ ...draft, currency: event.target.value.toUpperCase() })} required />
        </label>
        <label className={fieldClass}>
          Minimum guests *
          <input className={inputClass} type="number" min={1} value={draft.minGuests} onChange={(event) => onChange({ ...draft, minGuests: event.target.valueAsNumber })} required />
        </label>
        <label className={fieldClass}>
          Maximum guests *
          <input className={inputClass} type="number" min={1} value={draft.maxGuests} onChange={(event) => onChange({ ...draft, maxGuests: event.target.valueAsNumber })} required />
        </label>
        <label className={fieldClass}>
          Duration (minutes) *
          <input className={inputClass} type="number" min={15} max={480} value={draft.durationMinutes} onChange={(event) => onChange({ ...draft, durationMinutes: event.target.valueAsNumber })} required />
        </label>
        <label className={fieldClass}>
          Shown to customers
          <Select value={draft.active ? 'yes' : 'no'} onChange={(event) => onChange({ ...draft, active: event.target.value === 'yes' })}>
            <option value="yes">Active</option>
            <option value="no">Hidden</option>
          </Select>
        </label>
      </div>
      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="mb-1 text-xs text-mist">Included</legend>
        {inclusions.length === 0 && <p className="m-0 text-xs text-muted">Add inclusions before attaching them to a package.</p>}
        {inclusions.map((inclusion) => (
          <CheckboxField
            key={inclusion.id}
            label={inclusion.name}
            checked={draft.inclusionIds.includes(inclusion.id)}
            onChange={(checked) => toggleInclusion(inclusion.id, checked)}
          />
        ))}
      </fieldset>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className={errorClass} role="alert">{message}</div>;
}

export function onSubmit(handler: () => Promise<void>) {
  return (event: FormEvent) => {
    event.preventDefault();
    void handler();
  };
}
