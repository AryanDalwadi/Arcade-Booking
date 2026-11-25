import { useEffect, useState } from 'react';
import type { Inclusion, PackageTemplate } from '@arcade/contracts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { FormError, PackageFields, draftFromPackage, errorMessage, onSubmit, payloadFromDraft, type PackageDraft } from '../components/PackageFields';
import {
  PageTitle,
  ResourceMessage,
  fieldClass,
  noteClass,
  panelClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
  toolbarPrimaryButtonClass,
} from '../components/ui';
import { createPackageTemplate, deletePackageTemplate, formatInr, listInclusions, listPackageTemplates, updatePackageTemplate } from '../features/partiesApi';
import { useMenuAccess } from '../features/menuAccess';

const defaultPackageCodes = ['LITE', 'CLASSIC', 'PREMIUM'];

const emptyDraft = (): PackageDraft => ({
  description: '',
  priceRupees: '499',
  currency: 'INR',
  minGuests: 10,
  maxGuests: 40,
  durationMinutes: 60,
  active: true,
  inclusionIds: [],
});

export function PackageDefaultsPage() {
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/package-defaults');
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [inclusions, setInclusions] = useState<Inclusion[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [selected, setSelected] = useState<PackageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackageTemplate | null>(null);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<PackageDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    setStatus('loading');
    Promise.all([listPackageTemplates(), listInclusions()])
      .then(([packages, items]) => {
        setTemplates(packages);
        setInclusions(items);
        setStatus('ready');
      })
      .catch((loadError) => {
        setError(errorMessage(loadError, 'Packages could not be loaded'));
        setStatus('failed');
      });
  }

  useEffect(() => { reload(); }, []);

  function openCreate() {
    setSelected(null);
    setName('');
    setDraft(emptyDraft());
    setFormError(null);
    setMode('create');
  }

  function openEdit(template: PackageTemplate) {
    setSelected(template);
    setName(template.name);
    setDraft(draftFromPackage(template));
    setFormError(null);
    setMode('edit');
  }

  async function save() {
    const payload = payloadFromDraft(draft);
    if (typeof payload === 'string') {
      setFormError(payload);
      return;
    }
    if (name.trim().length < 2) {
      setFormError('Enter a package name');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (mode === 'create') await createPackageTemplate({ ...payload, name: name.trim() });
      else if (selected) await updatePackageTemplate(selected.code, { ...payload, name: name.trim() });
      setMode('closed');
      reload();
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Package could not be saved'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deletePackageTemplate(deleteTarget.code);
      setDeleteTarget(null);
      reload();
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Package could not be deleted'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="CELEBRATIONS"
        title="Packages"
        action={canAdd ? <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>+ New</button> : undefined}
      />
      <p className="mb-5 max-w-3xl text-sm leading-6 text-muted">
        Lite, Classic, and Premium stay as the default cards. A package you add appears in the list under the cards and in the venue dropdown.
      </p>
      {status === 'loading' && <ResourceMessage kind="loading">Loading packages…</ResourceMessage>}
      {status === 'failed' && <ResourceMessage kind="error">{error}</ResourceMessage>}
      {status === 'ready' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {defaultPackageCodes.map((code) => {
              const template = templates.find((item) => item.code === code);
              if (!template) return null;
              return (
                <article key={template.code} className={panelClass}>
                  <h2 className="m-0 text-xl">{template.name}</h2>
                  <p className="mt-2 text-sm text-mint">{formatInr(template.pricePerPersonCents)} per person</p>
                  <p className={`${noteClass} mt-3`}>{template.description}</p>
                  <p className={`${noteClass} mt-2`}>
                    {template.minGuests}–{template.maxGuests} guests · {template.durationMinutes} minutes · {template.active ? 'Active' : 'Hidden'}
                  </p>
                  <p className={`${noteClass} mt-2`}>{inclusionNames(template.inclusionIds, inclusions)}</p>
                  {canEdit && <button type="button" className={`${textButtonClass} mt-4`} onClick={() => openEdit(template)}>Edit</button>}
                </article>
              );
            })}
          </div>
          <h2 className="mb-3 mt-8 text-lg">Added packages</h2>
          <section className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  {(canEdit || canDelete) && <th className={thClass}>Actions</th>}
                  <th className={thClass}>Package</th>
                  <th className={thClass}>Price / person</th>
                  <th className={thClass}>Guests</th>
                  <th className={thClass}>Duration</th>
                  <th className={thClass}>Includes</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {extraPackages(templates).length === 0 && (
                  <tr><td className={tdClass} colSpan={canEdit || canDelete ? 7 : 6}>No extra packages yet. Use New to add one.</td></tr>
                )}
                {extraPackages(templates).map((template) => (
                  <tr key={template.code}>
                    {(canEdit || canDelete) && (
                      <td className={tdClass}>
                        <div className="flex gap-3">
                          {canEdit && <button type="button" className={textButtonClass} onClick={() => openEdit(template)}>Edit</button>}
                          {canDelete && <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(template)}>Delete</button>}
                        </div>
                      </td>
                    )}
                    <td className={tdClass}>{template.name}</td>
                    <td className={tdClass}>{formatInr(template.pricePerPersonCents)}</td>
                    <td className={tdClass}>{template.minGuests}–{template.maxGuests}</td>
                    <td className={tdClass}>{template.durationMinutes} min</td>
                    <td className={tdClass}>{inclusionNames(template.inclusionIds, inclusions)}</td>
                    <td className={tdClass}>{template.active ? 'Active' : 'Hidden'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      <Modal
        open={mode !== 'closed'}
        title={mode === 'create' ? 'New package' : `Edit ${selected?.name ?? 'package'}`}
        subtitle="Shown in the venue package dropdown"
        wide
        onClose={() => setMode('closed')}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={() => setMode('closed')}>Cancel</button>
            <button type="submit" form="template-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="template-form" className="grid gap-4" onSubmit={onSubmit(save)}>
          <label className={fieldClass}>
            Name *
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <PackageFields draft={draft} inclusions={inclusions} onChange={setDraft} />
          <FormError message={formError} />
        </form>
      </Modal>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete package?"
        message="New venues will no longer be able to select it. Venues that already use it keep their copy."
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

function extraPackages(templates: PackageTemplate[]) {
  return templates.filter((template) => !defaultPackageCodes.includes(template.code));
}

function inclusionNames(ids: string[], inclusions: Inclusion[]) {
  const names = inclusions.filter((item) => ids.includes(item.id)).map((item) => item.name);
  return names.length > 0 ? names.join(', ') : '—';
}
