import { useEffect, useState } from 'react';
import type { Inclusion } from '@arcade/contracts';
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
import { createInclusion, deleteInclusion, listInclusions, updateInclusion } from '../features/partiesApi';
import { useMenuAccess } from '../features/menuAccess';

const empty = { name: '', description: '', sortOrder: 0, active: true };

export function InclusionsPage() {
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/inclusions');
  const [rows, setRows] = useState<Inclusion[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [selected, setSelected] = useState<Inclusion | null>(null);
  const [draft, setDraft] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<Inclusion | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    setStatus('loading');
    listInclusions()
      .then((inclusions) => {
        setRows(inclusions);
        setStatus('ready');
      })
      .catch((loadError) => {
        setError(errorMessage(loadError, 'Inclusions could not be loaded'));
        setStatus('failed');
      });
  }

  useEffect(() => { reload(); }, []);

  function openCreate() {
    setSelected(null);
    setDraft(empty);
    setFormError(null);
    setMode('create');
  }

  function openEdit(inclusion: Inclusion) {
    setSelected(inclusion);
    setDraft({
      name: inclusion.name,
      description: inclusion.description,
      sortOrder: inclusion.sortOrder,
      active: inclusion.active,
    });
    setFormError(null);
    setMode('edit');
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      sortOrder: draft.sortOrder,
      active: draft.active,
    };
    try {
      if (mode === 'create') await createInclusion(body);
      else if (selected) await updateInclusion(selected.id, body);
      setMode('closed');
      reload();
    } catch (saveError) {
      setFormError(errorMessage(saveError, 'Inclusion could not be saved'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteInclusion(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Inclusion could not be deleted'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="CELEBRATIONS"
        title="Inclusions"
        action={canAdd ? <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>+ New</button> : undefined}
      />
      <p className="mb-5 max-w-3xl text-sm leading-6 text-muted">
        Inclusions are the items a package can include, such as arcade play, a host, or food. Packages tick these instead of retyping them.
      </p>
      {status === 'loading' && <ResourceMessage kind="loading">Loading inclusions…</ResourceMessage>}
      {status === 'failed' && <ResourceMessage kind="error">{error}</ResourceMessage>}
      {status === 'ready' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                {(canEdit || canDelete) && <th className={thClass}>Actions</th>}
                <th className={thClass}>Name</th>
                <th className={thClass}>Description</th>
                <th className={thClass}>Order</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td className={tdClass} colSpan={canEdit || canDelete ? 5 : 4}>No inclusions yet.</td></tr>
              )}
              {rows.map((inclusion) => (
                <tr key={inclusion.id}>
                  {(canEdit || canDelete) && (
                    <td className={tdClass}>
                      <div className="flex gap-3">
                        {canEdit && <button type="button" className={textButtonClass} onClick={() => openEdit(inclusion)}>Edit</button>}
                        {canDelete && <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(inclusion)}>Delete</button>}
                      </div>
                    </td>
                  )}
                  <td className={tdClass}>{inclusion.name}</td>
                  <td className={tdClass}>{inclusion.description || '—'}</td>
                  <td className={tdClass}>{inclusion.sortOrder}</td>
                  <td className={tdClass}>{inclusion.active ? 'Active' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <Modal
        open={mode !== 'closed'}
        title={mode === 'create' ? 'New inclusion' : 'Edit inclusion'}
        onClose={() => setMode('closed')}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={() => setMode('closed')}>Cancel</button>
            <button type="submit" form="inclusion-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="inclusion-form" className="grid gap-4" onSubmit={onSubmit(save)}>
          <label className={fieldClass}>
            Name *
            <input className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
          </label>
          <label className={fieldClass}>
            Description
            <textarea className={inputClass} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <label className={fieldClass}>
            Sort order
            <input className={inputClass} type="number" min={0} value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.valueAsNumber || 0 })} />
          </label>
          <label className={fieldClass}>
            Status
            <Select value={draft.active ? 'yes' : 'no'} onChange={(event) => setDraft({ ...draft, active: event.target.value === 'yes' })}>
              <option value="yes">Active</option>
              <option value="no">Hidden</option>
            </Select>
          </label>
          <FormError message={formError} />
        </form>
      </Modal>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete inclusion?"
        message="Packages that include this item will lose it."
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
