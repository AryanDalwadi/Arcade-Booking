import { useEffect, useState } from 'react';
import type { PartyType } from '@arcade/contracts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { FormError, errorMessage, onSubmit } from '../components/PackageFields';
import {
  PageTitle,
  ResourceMessage,
  fieldClass,
  inputClass,
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
import { createPartyType, deletePartyType, listPartyTypes, updatePartyType } from '../features/partiesApi';
import { useMenuAccess } from '../features/menuAccess';

export function PartyTypesPage() {
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/party-types');
  const [types, setTypes] = useState<PartyType[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [selected, setSelected] = useState<PartyType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartyType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPartyTypes()
      .then((rows) => {
        if (cancelled) return;
        setTypes(rows);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(errorMessage(loadError, 'Party types could not be loaded'));
        setStatus('failed');
      });
    return () => { cancelled = true; };
  }, []);

  function openCreate() {
    setSelected(null);
    setTitle('');
    setDescription('');
    setActive(true);
    setFormError(null);
    setMode('create');
  }

  function openEdit(type: PartyType) {
    setSelected(type);
    setTitle(type.title);
    setDescription(type.description);
    setActive(type.active);
    setFormError(null);
    setMode('edit');
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      if (mode === 'create') {
        await createPartyType({ title: title.trim(), description: description.trim(), active });
      } else if (selected) {
        await updatePartyType(selected.id, { title: title.trim(), description: description.trim(), active });
      }
      setMode('closed');
      const rows = await listPartyTypes();
      setTypes(rows);
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Party type could not be saved'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deletePartyType(deleteTarget.id);
      setDeleteTarget(null);
      setTypes(await listPartyTypes());
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Party type could not be deleted'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="CELEBRATIONS"
        title="Party types"
        action={canAdd ? <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>+ New</button> : undefined}
      />
      <p className="mb-5 max-w-3xl text-sm leading-6 text-muted">
        Birthday, school trip, and work party are already in the list. Add another type, or update and delete any row. Venues can then offer the types you keep here.
      </p>
      {status === 'loading' && <ResourceMessage kind="loading">Loading party types…</ResourceMessage>}
      {status === 'failed' && <ResourceMessage kind="error">{error}</ResourceMessage>}
      {status === 'ready' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                {(canEdit || canDelete) && <th className={thClass}>Actions</th>}
                <th className={thClass}>Type</th>
                <th className={thClass}>Description</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id}>
                  {(canEdit || canDelete) && (
                    <td className={tdClass}>
                      <div className="flex gap-3">
                        {canEdit && <button type="button" className={textButtonClass} onClick={() => openEdit(type)}>Edit</button>}
                        {canDelete && <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(type)}>Delete</button>}
                      </div>
                    </td>
                  )}
                  <td className={tdClass}>{type.title}</td>
                  <td className={tdClass}>{type.description}</td>
                  <td className={tdClass}>{type.active ? 'Active' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <Modal
        open={mode !== 'closed'}
        title={mode === 'create' ? 'New party type' : 'Edit party type'}
        subtitle={mode === 'edit' ? selected?.title : undefined}
        onClose={() => setMode('closed')}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={() => setMode('closed')}>Cancel</button>
            <button type="submit" form="party-type-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="party-type-form" className="grid gap-4" onSubmit={onSubmit(save)}>
          <label className={fieldClass}>
            Title *
            <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label className={fieldClass}>
            Description
            <textarea className={inputClass} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className={fieldClass}>
            Status
            <Select value={active ? 'yes' : 'no'} onChange={(event) => setActive(event.target.value === 'yes')}>
              <option value="yes">Active</option>
              <option value="no">Hidden</option>
            </Select>
          </label>
          <FormError message={formError} />
        </form>
      </Modal>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete party type?"
        message="Venues that offer this type will no longer include it."
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
