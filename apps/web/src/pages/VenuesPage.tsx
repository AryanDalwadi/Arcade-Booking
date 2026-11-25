import { useEffect, useState } from 'react';
import type { Inclusion, PackageTemplate, PartyRoom, PartyType, Venue, VenueBlackout, VenueHour, VenuePackage } from '@arcade/contracts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import {
  FormError,
  PackageFields,
  draftFromPackage,
  errorMessage,
  onSubmit,
  payloadFromDraft,
  type PackageDraft,
} from '../components/PackageFields';
import {
  CheckboxField,
  PageTitle,
  ResourceMessage,
  fieldClass,
  inputClass,
  noteClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  Select,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
  toolbarPrimaryButtonClass,
} from '../components/ui';
import { useMenuAccess } from '../features/menuAccess';
import {
  createBlackout,
  createRoom,
  createVenue,
  deleteBlackout,
  deleteRoom,
  deleteVenue,
  formatInr,
  listBlackouts,
  listHours,
  listInclusions,
  listPackageTemplates,
  listPartyTypes,
  listRooms,
  listVenuePackages,
  listVenues,
  resetVenuePackage,
  saveHours,
  slugFromName,
  updateVenue,
  updateVenuePackage,
} from '../features/partiesApi';

const defaultPackageCodes = ['LITE', 'CLASSIC', 'PREMIUM'];

const weekDays = [
  { dayOfWeek: 1, label: 'Monday' },
  { dayOfWeek: 2, label: 'Tuesday' },
  { dayOfWeek: 3, label: 'Wednesday' },
  { dayOfWeek: 4, label: 'Thursday' },
  { dayOfWeek: 5, label: 'Friday' },
  { dayOfWeek: 6, label: 'Saturday' },
  { dayOfWeek: 0, label: 'Sunday' },
] as const;

type VenueDraft = {
  name: string;
  slug: string;
  city: string;
  mall: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  timezone: string;
  active: boolean;
  partyTypeIds: string[];
  packageCodes: string[];
};

const emptyVenue = (partyTypeIds: string[], packageCodes: string[]): VenueDraft => ({
  name: '',
  slug: '',
  city: '',
  mall: '',
  address: '',
  phone: '',
  email: '',
  description: '',
  timezone: 'Asia/Kolkata',
  active: true,
  partyTypeIds,
  packageCodes,
});

function draftFromVenue(venue: Venue): VenueDraft {
  return {
    name: venue.name,
    slug: venue.slug,
    city: venue.city,
    mall: venue.mall,
    address: venue.address,
    phone: venue.phone,
    email: venue.email,
    description: venue.description,
    timezone: venue.timezone,
    active: venue.active,
    partyTypeIds: venue.partyTypeIds,
    packageCodes: venue.packageCodes ?? [],
  };
}

export function VenuesPage() {
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/venues');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [partyTypes, setPartyTypes] = useState<PartyType[]>([]);
  const [packages, setPackages] = useState<PackageTemplate[]>([]);
  const [inclusions, setInclusions] = useState<Inclusion[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editing, setEditing] = useState<Venue | null>(null);
  const [draft, setDraft] = useState<VenueDraft>(emptyVenue([], []));
  const [slugTouched, setSlugTouched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reload() {
    setStatus('loading');
    Promise.all([listVenues(), listPartyTypes(), listInclusions(), listPackageTemplates()])
      .then(([venueRows, types, items, packageRows]) => {
        setVenues(venueRows);
        setPartyTypes(types);
        setInclusions(items);
        setPackages(packageRows);
        setStatus('ready');
      })
      .catch((loadError) => {
        setError(errorMessage(loadError, 'Venues could not be loaded'));
        setStatus('failed');
      });
  }

  useEffect(() => { reload(); }, []);

  function openCreate() {
    setEditing(null);
    setDraft(emptyVenue(
      partyTypes.filter((type) => type.active).map((type) => type.id),
      defaultPackageCodes.filter((code) => packages.some((pkg) => pkg.code === code)),
    ));
    setSlugTouched(false);
    setFormError(null);
    setMode('create');
  }

  function openEdit(venue: Venue) {
    setEditing(venue);
    setDraft(draftFromVenue(venue));
    setSlugTouched(true);
    setFormError(null);
    setMode('edit');
  }

  function changeName(name: string) {
    setDraft((current) => ({
      ...current,
      name,
      slug: slugTouched ? current.slug : slugFromName(name),
    }));
  }

  function togglePartyType(id: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      partyTypeIds: checked
        ? [...current.partyTypeIds, id]
        : current.partyTypeIds.filter((item) => item !== id),
    }));
  }

  async function saveVenue() {
    if (draft.partyTypeIds.length === 0) {
      setFormError('Choose at least one party type');
      return;
    }
    if (draft.packageCodes.length === 0) {
      setFormError('Choose at least one package');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      name: draft.name.trim(),
      slug: slugFromName(draft.slug),
      city: draft.city.trim(),
      mall: draft.mall.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      description: draft.description.trim(),
      timezone: draft.timezone.trim() || 'Asia/Kolkata',
      active: draft.active,
      partyTypeIds: draft.partyTypeIds,
      packageCodes: draft.packageCodes,
    };
    try {
      const saved = mode === 'create' ? await createVenue(body) : await updateVenue(editing!.id, body);
      setMode('closed');
      setNotice(mode === 'create'
        ? `${saved.name} was created with Lite, Classic, and Premium.`
        : `${saved.name} was updated.`);
      reload();
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Venue could not be saved'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteVenue(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      setNotice('Venue deleted.');
      reload();
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Venue could not be deleted'));
    } finally {
      setSaving(false);
    }
  }

  const selected = venues.find((venue) => venue.id === selectedId) ?? null;

  return (
    <>
      <PageTitle
        eyebrow="CELEBRATIONS"
        title="Venues"
        action={canAdd ? <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>+ New</button> : undefined}
      />
      <p className="mb-5 max-w-3xl text-sm leading-6 text-muted">
        A venue is a place customers can book. Choose its party types and packages in the form. Lite, Classic, and Premium start selected. Packages you add on the Packages screen appear in that dropdown.
      </p>
      {notice && (
        <ResourceMessage kind="success">
          {notice}
          <button type="button" className={`${textButtonClass} ml-2`} onClick={() => setNotice(null)}>Dismiss</button>
        </ResourceMessage>
      )}
      {status === 'loading' && <ResourceMessage kind="loading">Loading venues…</ResourceMessage>}
      {status === 'failed' && <ResourceMessage kind="error">{error}</ResourceMessage>}
      {status === 'ready' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Actions</th>
                <th className={thClass}>Venue</th>
                <th className={thClass}>City</th>
                <th className={thClass}>Booking link</th>
                <th className={thClass}>Party types</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {venues.length === 0 && (
                <tr><td className={tdClass} colSpan={6}>No venues yet.</td></tr>
              )}
              {venues.map((venue) => (
                <tr key={venue.id} className={venue.id === selectedId ? 'bg-white/4' : undefined}>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className={textButtonClass} onClick={() => setSelectedId(venue.id)}>Manage</button>
                      {canEdit && <button type="button" className={textButtonClass} onClick={() => openEdit(venue)}>Edit</button>}
                      {canDelete && <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(venue)}>Delete</button>}
                    </div>
                  </td>
                  <td className={tdClass}>{venue.name}</td>
                  <td className={tdClass}>{venue.city || '—'}</td>
                  <td className={tdClass}>{venue.slug}</td>
                  <td className={tdClass}>{partyTypeLabels(venue.partyTypeIds, partyTypes)}</td>
                  <td className={tdClass}>{venue.active ? 'Active' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Modal
        open={selected !== null}
        title={selected?.name ?? 'Venue'}
        subtitle={selected ? `Packages, rooms, hours, and blocked dates for ${selected.name}.` : undefined}
        wider
        onClose={() => setSelectedId(null)}
        footer={(
          <button type="button" className={secondaryButtonClass()} onClick={() => setSelectedId(null)}>Close</button>
        )}
      >
        {selected && (
          <VenueSetup
            venue={selected}
            inclusions={inclusions}
            canEdit={canEdit}
            onNotice={setNotice}
          />
        )}
      </Modal>

      <Modal
        open={mode !== 'closed'}
        title={mode === 'create' ? 'New venue' : 'Edit venue'}
        subtitle={mode === 'create' ? 'Choose the packages this venue offers' : editing?.name}
        wide
        onClose={() => setMode('closed')}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={() => setMode('closed')}>Cancel</button>
            <button type="submit" form="venue-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="venue-form" className="grid gap-4" onSubmit={onSubmit(saveVenue)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldClass}>
              Name *
              <input className={inputClass} value={draft.name} onChange={(event) => changeName(event.target.value)} required />
            </label>
            <label className={fieldClass}>
              Booking link *
              <input
                className={inputClass}
                value={draft.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setDraft({ ...draft, slug: event.target.value });
                }}
                required
              />
            </label>
            <label className={fieldClass}>
              City
              <input className={inputClass} value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
            </label>
            <label className={fieldClass}>
              Mall
              <input className={inputClass} value={draft.mall} onChange={(event) => setDraft({ ...draft, mall: event.target.value })} />
            </label>
            <label className={fieldClass}>
              Phone
              <input className={inputClass} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
            </label>
            <label className={fieldClass}>
              Email
              <input className={inputClass} type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
            </label>
          </div>
          <label className={fieldClass}>
            Address
            <input className={inputClass} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
          </label>
          <label className={fieldClass}>
            Description
            <textarea className={inputClass} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <label className={fieldClass}>
            Timezone
            <input className={inputClass} value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} />
          </label>
          <label className={fieldClass}>
            Status
            <Select value={draft.active ? 'yes' : 'no'} onChange={(event) => setDraft({ ...draft, active: event.target.value === 'yes' })}>
              <option value="yes">Active</option>
              <option value="no">Hidden</option>
            </Select>
          </label>
          <label className={fieldClass}>
            Packages *
            <Select
              value=""
              onChange={(event) => {
                const code = event.target.value;
                if (!code || draft.packageCodes.includes(code)) return;
                setDraft({ ...draft, packageCodes: [...draft.packageCodes, code] });
              }}
            >
              <option value="">Default</option>
              {orderedPackages(packages).map((pkg) => (
                <option key={pkg.code} value={pkg.code}>{pkg.name}</option>
              ))}
            </Select>
          </label>
          {shownPackageCodes(draft.packageCodes).length === 0 && <p className={noteClass}>No package selected yet.</p>}
          {shownPackageCodes(draft.packageCodes).length > 0 && (
            <ul className="m-0 grid gap-2 p-0">
              {shownPackageCodes(draft.packageCodes).map((code) => {
                const pkg = packages.find((item) => item.code === code);
                return (
                  <li key={code} className="flex items-center justify-between gap-3 text-sm">
                    <span>{pkg?.name ?? code}{pkg ? ` · ${formatInr(pkg.pricePerPersonCents)} / person` : ''}</span>
                    <button
                      type="button"
                      className={textButtonClass}
                      onClick={() => setDraft({ ...draft, packageCodes: draft.packageCodes.filter((item) => item !== code) })}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <fieldset className="grid gap-2 border-0 p-0">
            <legend className="mb-1 text-xs text-mist">Party types *</legend>
            {partyTypes.map((type) => (
              <CheckboxField
                key={type.id}
                label={type.title}
                checked={draft.partyTypeIds.includes(type.id)}
                onChange={(checked) => togglePartyType(type.id, checked)}
              />
            ))}
          </fieldset>
          <FormError message={formError} />
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete venue?"
        message="This removes the venue, its three packages, rooms, and schedule."
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

function partyTypeLabels(ids: string[], types: PartyType[]) {
  const labels = types.filter((type) => ids.includes(type.id)).map((type) => type.title);
  return labels.length > 0 ? labels.join(', ') : '—';
}

function VenueSetup({
  venue,
  inclusions,
  canEdit,
  onNotice,
}: {
  venue: Venue;
  inclusions: Inclusion[];
  canEdit: boolean;
  onNotice: (message: string) => void;
}) {
  const [packages, setPackages] = useState<VenuePackage[]>([]);
  const [rooms, setRooms] = useState<PartyRoom[]>([]);
  const [hours, setHours] = useState<VenueHour[]>([]);
  const [blackouts, setBlackouts] = useState<VenueBlackout[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [packageEdit, setPackageEdit] = useState<VenuePackage | null>(null);
  const [packageDraft, setPackageDraft] = useState<PackageDraft | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState(30);
  const [blackoutDate, setBlackoutDate] = useState('');
  const [blackoutReason, setBlackoutReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setStatus('loading');
    Promise.all([
      listVenuePackages(venue.id),
      listRooms(venue.id),
      listHours(venue.id),
      listBlackouts(venue.id),
    ]).then(([packageRows, roomRows, hourRows, blackoutRows]) => {
      setPackages(packageRows);
      setRooms(roomRows);
      setHours(mergeHours(hourRows));
      setBlackouts(blackoutRows);
      setStatus('ready');
    }).catch((loadError) => {
      setError(errorMessage(loadError, 'Venue setup could not be loaded'));
      setStatus('failed');
    });
  }

  useEffect(() => { load(); }, [venue.id]);

  function openPackage(pkg: VenuePackage) {
    setPackageEdit(pkg);
    setPackageDraft(draftFromPackage(pkg));
    setFormError(null);
  }

  async function savePackage() {
    if (!packageEdit || !packageDraft) return;
    const payload = payloadFromDraft(packageDraft);
    if (typeof payload === 'string') {
      setFormError(payload);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateVenuePackage(venue.id, packageEdit.code, payload);
      setPackageEdit(null);
      onNotice(`${packageEdit.name} was updated for ${venue.name}.`);
      load();
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Package could not be saved'));
    } finally {
      setSaving(false);
    }
  }

  async function resetPackage() {
    if (!packageEdit) return;
    setSaving(true);
    setFormError(null);
    try {
      await resetVenuePackage(venue.id, packageEdit.code);
      setPackageEdit(null);
      onNotice(`${packageEdit.name} was reset to the current default.`);
      load();
    } catch (resetError) {
      setFormError(errorMessage(resetError, 'Package could not be reset'));
    } finally {
      setSaving(false);
    }
  }

  async function addRoom() {
    setSaving(true);
    setFormError(null);
    try {
      await createRoom(venue.id, { name: roomName.trim(), capacity: roomCapacity, active: true });
      setRoomName('');
      setRoomCapacity(30);
      load();
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Room could not be added'));
    } finally {
      setSaving(false);
    }
  }

  async function removeRoom(roomId: string) {
    try {
      await deleteRoom(venue.id, roomId);
      load();
    } catch (deleteError) {
      setFormError(errorMessage(deleteError, 'Room could not be removed'));
    }
  }

  function changeHour(dayOfWeek: number, patch: Partial<VenueHour>) {
    setHours((current) => mergeHours(current).map((hour) => hour.dayOfWeek === dayOfWeek ? { ...hour, ...patch } : hour));
  }

  async function saveSchedule() {
    setSaving(true);
    setFormError(null);
    try {
      setHours(await saveHours(venue.id, hours));
      onNotice(`Schedule saved for ${venue.name}.`);
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Schedule could not be saved'));
    } finally {
      setSaving(false);
    }
  }

  async function addBlackout() {
    setSaving(true);
    setFormError(null);
    try {
      await createBlackout(venue.id, { blackoutDate, reason: blackoutReason.trim() });
      setBlackoutDate('');
      setBlackoutReason('');
      load();
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Date could not be blocked'));
    } finally {
      setSaving(false);
    }
  }

  async function removeBlackout(id: string) {
    try {
      await deleteBlackout(venue.id, id);
      load();
    } catch (deleteError) {
      setFormError(errorMessage(deleteError, 'Blocked date could not be removed'));
    }
  }

  return (
    <div className="grid gap-6">
      <p className={noteClass}>
        These are the packages selected for {venue.name}. Editing one changes only this venue. Add a package on the Packages screen, then choose it in this venue’s dropdown.
      </p>
      {status === 'loading' && <ResourceMessage kind="loading">Loading venue setup…</ResourceMessage>}
      {status === 'failed' && <ResourceMessage kind="error">{error}</ResourceMessage>}
      {status === 'ready' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {packages.map((pkg) => (
              <article key={pkg.id} className={panelClass}>
                <h3 className="m-0 text-xl">{pkg.name}</h3>
                <p className="mt-2 text-sm text-mint">{formatInr(pkg.pricePerPersonCents)} per person</p>
                <p className={`${noteClass} mt-3`}>{pkg.description}</p>
                <p className={`${noteClass} mt-2`}>
                  Minimum {pkg.minGuests} guests · {pkg.durationMinutes} minutes · {pkg.active ? 'Shown' : 'Hidden'}
                </p>
                <p className={`${noteClass} mt-2`}>{inclusionLabel(pkg.inclusionIds, inclusions)}</p>
                {canEdit && <button type="button" className={`${textButtonClass} mt-4`} onClick={() => openPackage(pkg)}>Edit</button>}
              </article>
            ))}
          </div>

          <div className={`${panelClass} grid gap-4`}>
            <h3 className="m-0 text-lg">Party rooms</h3>
            {rooms.length === 0 && <p className={noteClass}>No rooms yet. A slot can be sold once for each active room.</p>}
            {rooms.length > 0 && (
              <ul className="m-0 grid gap-2 p-0">
                {rooms.map((room) => (
                  <li key={room.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{room.name} · {room.capacity} guests</span>
                    {canEdit && <button type="button" className={textButtonClass} onClick={() => void removeRoom(room.id)}>Remove</button>}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <form className="grid gap-3 sm:grid-cols-[1fr_140px_auto]" onSubmit={onSubmit(addRoom)}>
                <input className={inputClass} placeholder="Room name" value={roomName} onChange={(event) => setRoomName(event.target.value)} required />
                <input className={inputClass} type="number" min={1} aria-label="Room capacity" value={roomCapacity} onChange={(event) => setRoomCapacity(event.target.valueAsNumber)} required />
                <button type="submit" className={secondaryButtonClass()} disabled={saving}>Add room</button>
              </form>
            )}
          </div>

          <div className={`${panelClass} grid gap-4`}>
            <h3 className="m-0 text-lg">Weekly hours</h3>
            <p className={noteClass}>Customers can reserve one-hour slots inside these hours. New venues start at 11:00–21:00 every day.</p>
            <div className="grid gap-3">
              {weekDays.map((day) => {
                const hour = hours.find((item) => item.dayOfWeek === day.dayOfWeek) ?? defaultHour(day.dayOfWeek);
                return (
                  <div key={day.dayOfWeek} className="grid items-center gap-3 sm:grid-cols-[140px_1fr_1fr_120px]">
                    <CheckboxField label={day.label} checked={hour.active} onChange={(checked) => changeHour(day.dayOfWeek, { active: checked, dayOfWeek: day.dayOfWeek, opensAt: hour.opensAt, closesAt: hour.closesAt, slotMinutes: hour.slotMinutes })} />
                    <input className={inputClass} type="time" aria-label={`${day.label} opens`} value={hour.opensAt} onChange={(event) => changeHour(day.dayOfWeek, { ...hour, opensAt: event.target.value })} />
                    <input className={inputClass} type="time" aria-label={`${day.label} closes`} value={hour.closesAt} onChange={(event) => changeHour(day.dayOfWeek, { ...hour, closesAt: event.target.value })} />
                    <input className={inputClass} type="number" min={15} aria-label={`${day.label} slot minutes`} value={hour.slotMinutes} onChange={(event) => changeHour(day.dayOfWeek, { ...hour, slotMinutes: event.target.valueAsNumber })} />
                  </div>
                );
              })}
            </div>
            {canEdit && <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={() => void saveSchedule()} disabled={saving}>Save hours</button>}
          </div>

          <div className={`${panelClass} grid gap-4`}>
            <h3 className="m-0 text-lg">Blocked dates</h3>
            {blackouts.length === 0 && <p className={noteClass}>No dates are blocked.</p>}
            {blackouts.length > 0 && (
              <ul className="m-0 grid gap-2 p-0">
                {blackouts.map((blackout) => (
                  <li key={blackout.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{blackout.blackoutDate}{blackout.reason ? ` · ${blackout.reason}` : ''}</span>
                    {canEdit && <button type="button" className={textButtonClass} onClick={() => void removeBlackout(blackout.id)}>Remove</button>}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <form className="grid gap-3 sm:grid-cols-[180px_1fr_auto]" onSubmit={onSubmit(addBlackout)}>
                <input className={inputClass} type="date" aria-label="Blocked date" value={blackoutDate} onChange={(event) => setBlackoutDate(event.target.value)} required />
                <input className={inputClass} placeholder="Reason" value={blackoutReason} onChange={(event) => setBlackoutReason(event.target.value)} />
                <button type="submit" className={secondaryButtonClass()} disabled={saving}>Block date</button>
              </form>
            )}
          </div>
          <FormError message={formError} />
        </>
      )}

      <Modal
        open={packageEdit !== null && packageDraft !== null}
        title={`Edit ${packageEdit?.name ?? 'package'}`}
        subtitle={venue.name}
        wide
        onClose={() => setPackageEdit(null)}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={() => void resetPackage()} disabled={saving}>Reset to default</button>
            <button type="button" className={secondaryButtonClass()} onClick={() => setPackageEdit(null)}>Cancel</button>
            <button type="submit" form="venue-package-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        {packageDraft && (
          <form id="venue-package-form" className="grid gap-4" onSubmit={onSubmit(savePackage)}>
            <p className={noteClass}>The name stays {packageEdit?.name}. Price, inclusions, guest limits, and duration can change for this venue.</p>
            <PackageFields draft={packageDraft} inclusions={inclusions} onChange={setPackageDraft} />
            <FormError message={formError} />
          </form>
        )}
      </Modal>
    </div>
  );
}

function orderedPackages(packages: PackageTemplate[]) {
  const defaults = defaultPackageCodes
    .map((code) => packages.find((pkg) => pkg.code === code))
    .filter((pkg): pkg is PackageTemplate => Boolean(pkg));
  const extras = packages.filter((pkg) => !defaultPackageCodes.includes(pkg.code));
  return [...defaults, ...extras];
}

function shownPackageCodes(codes: string[]) {
  return [
    ...defaultPackageCodes.filter((code) => codes.includes(code)),
    ...codes.filter((code) => !defaultPackageCodes.includes(code)),
  ];
}

function defaultHour(dayOfWeek: number): VenueHour {
  return { dayOfWeek, opensAt: '11:00', closesAt: '21:00', slotMinutes: 60, active: true };
}

function mergeHours(rows: VenueHour[]): VenueHour[] {
  return weekDays.map((day) => rows.find((item) => item.dayOfWeek === day.dayOfWeek) ?? defaultHour(day.dayOfWeek));
}

function inclusionLabel(ids: string[], inclusions: Inclusion[]) {
  const names = inclusions.filter((item) => ids.includes(item.id)).map((item) => item.name);
  return names.length > 0 ? names.join(', ') : 'No inclusions selected';
}
