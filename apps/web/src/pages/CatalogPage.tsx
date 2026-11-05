import { useEffect, useState, type FormEvent } from 'react';
import {
  MachineCard,
  PageTitle,
  ResourceMessage,
  errorClass,
  fieldClass,
  inputClass,
  panelClass,
  primaryButtonClass,
  textButtonClass,
} from '../components/ui';
import { createMachineWithPricing, fetchMachines } from '../features/catalogSlice';
import { useAppDispatch, useAppSelector } from '../store';

export function CatalogPage({ manage = false }: { manage?: boolean }) {
  const [name, setName] = useState('');
  const [statusValue, setStatusValue] = useState<'ACTIVE' | 'MAINTENANCE' | 'RETIRED'>('ACTIVE');
  const [pricePerHourCents, setPricePerHourCents] = useState(6000);
  const [currency, setCurrency] = useState('INR');
  const dispatch = useAppDispatch();
  const { machines, status, error, mutationStatus, mutationError } =
    useAppSelector((state) => state.catalog);

  useEffect(() => {
    if (status === 'idle') void dispatch(fetchMachines());
  }, [dispatch, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await dispatch(createMachineWithPricing({
      name: name.trim(),
      status: statusValue,
      pricePerHourCents,
      currency: currency.toUpperCase(),
    })).unwrap();
    setName('');
  }

  return (
    <>
      <PageTitle
        eyebrow={manage ? 'CATALOG ADMINISTRATION' : 'CATALOG'}
        title={manage ? 'Manage machines and pricing' : 'Arcade machines'}
      />
      {manage && (
        <form className={`${panelClass} mb-5.5 grid grid-cols-[repeat(4,minmax(130px,1fr))] items-end gap-3.5 max-sm:grid-cols-1`} onSubmit={(event) => void submit(event).catch(() => undefined)}>
          <label className={fieldClass}>Machine name
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className={fieldClass}>Status
            <select className={inputClass} value={statusValue} onChange={(event) => setStatusValue(event.target.value as typeof statusValue)}>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="RETIRED">Retired</option>
            </select>
          </label>
          <label className={fieldClass}>Hourly price (minor units)
            <input className={inputClass} type="number" min={1} value={pricePerHourCents} onChange={(event) => setPricePerHourCents(event.target.valueAsNumber)} required />
          </label>
          <label className={fieldClass}>Currency
            <input className={inputClass} value={currency} minLength={3} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required />
          </label>
          <button className={primaryButtonClass()} disabled={mutationStatus === 'loading'}>
            {mutationStatus === 'loading' ? 'Creating…' : 'Add machine with pricing'}
          </button>
          {mutationError && <div className={`${errorClass} col-span-full`} role="alert">{mutationError}</div>}
        </form>
      )}
      {status === 'loading' && <ResourceMessage kind="loading">Loading machines…</ResourceMessage>}
      {status === 'failed' && (
        <ResourceMessage kind="error">
          {error} <button className={textButtonClass} onClick={() => void dispatch(fetchMachines())}>Retry</button>
        </ResourceMessage>
      )}
      {status === 'succeeded' && machines.length === 0 && <ResourceMessage kind="empty">No machines are in the catalog.</ResourceMessage>}
      {machines.length > 0 && (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {machines.map((machine) => <MachineCard key={machine.id} machine={machine} />)}
        </div>
      )}
    </>
  );
}
