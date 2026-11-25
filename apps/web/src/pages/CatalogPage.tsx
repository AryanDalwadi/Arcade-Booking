import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CatalogMachine, Machine } from '@arcade/contracts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterBar, FilterSelect, FilterTextInput } from '../components/FilterBar';
import { Modal } from '../components/Modal';
import { TableFooter } from '../components/TableFooter';
import {
  MachineCard,
  PageTitle,
  ResourceMessage,
  errorClass,
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
import {
  createMachineWithPricing,
  deleteMachine,
  fetchMachines,
  updateMachineWithPricing,
} from '../features/catalogSlice';
import { useMenuAccess } from '../features/menuAccess';
import { useAppDispatch, useAppSelector } from '../store';

type DialogMode = 'closed' | 'create' | 'edit';
type MachineStatus = Machine['status'];

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];

export function CatalogPage({ manage = false }: { manage?: boolean }) {
  const dispatch = useAppDispatch();
  const { machines, status, error } = useAppSelector((state) => state.catalog);

  useEffect(() => {
    if (status === 'idle') void dispatch(fetchMachines());
  }, [dispatch, status]);

  if (!manage) {
    return (
      <>
        <PageTitle eyebrow="CATALOG" title="Arcade machines" />
        <MachineList machines={machines} status={status} error={error} onRetry={() => void dispatch(fetchMachines())} />
      </>
    );
  }

  return <ManageCatalog />;
}

function MachineList({
  machines,
  status,
  error,
  onRetry,
}: {
  machines: CatalogMachine[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <>
      {status === 'loading' && <ResourceMessage kind="loading">Loading machines…</ResourceMessage>}
      {status === 'failed' && (
        <ResourceMessage kind="error">
          {error} <button className={textButtonClass} onClick={onRetry}>Retry</button>
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

function ManageCatalog() {
  const dispatch = useAppDispatch();
  const { canAdd, canEdit, canDelete } = useMenuAccess('/admin/catalog');
  const showActions = canEdit || canDelete;
  const { machines, status, error, mutationStatus, mutationError } = useAppSelector((state) => state.catalog);

  useEffect(() => {
    if (status === 'idle') void dispatch(fetchMachines());
  }, [dispatch, status]);
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dense, setDense] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed');
  const [selected, setSelected] = useState<CatalogMachine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogMachine | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [statusValue, setStatusValue] = useState<MachineStatus>('ACTIVE');
  const [pricePerHourCents, setPricePerHourCents] = useState(6000);
  const [currency, setCurrency] = useState('INR');

  const filtered = useMemo(() => {
    const term = nameFilter.trim().toLowerCase();
    return machines.filter((machine) => {
      if (term && !machine.name.toLowerCase().includes(term)) return false;
      if (statusFilter !== 'ALL' && machine.status !== statusFilter) return false;
      return true;
    });
  }, [machines, nameFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openCreate() {
    setSelected(null);
    setName('');
    setStatusValue('ACTIVE');
    setPricePerHourCents(6000);
    setCurrency('INR');
    setDialogMode('create');
  }

  function openEdit(machine: CatalogMachine) {
    setSelected(machine);
    setName(machine.name);
    setStatusValue(machine.status);
    setPricePerHourCents(machine.pricePerHourCents ?? 6000);
    setCurrency(machine.currency ?? 'INR');
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode('closed');
    setSelected(null);
  }

  async function saveMachine(event: FormEvent) {
    event.preventDefault();
    if (dialogMode === 'create' && !canAdd) return;
    if (dialogMode === 'edit' && !canEdit) return;
    const input = {
      name: name.trim(),
      status: statusValue,
      pricePerHourCents,
      currency: currency.toUpperCase(),
    };
    try {
      if (dialogMode === 'create') {
        await dispatch(createMachineWithPricing(input)).unwrap();
        setSuccessMessage('Machine created successfully.');
      } else if (selected) {
        await dispatch(updateMachineWithPricing({ ...input, id: selected.id })).unwrap();
        setSuccessMessage('Machine updated successfully.');
      }
      closeDialog();
    } catch {
      // mutationError is shown in the dialog
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteMachine(deleteTarget.id)).unwrap();
      setDeleteTarget(null);
      setSuccessMessage('Machine deleted successfully.');
    } catch {
      // mutationError is shown below the table
    }
  }

  const cellClass = dense ? `${tdClass} !py-2` : tdClass;
  const loading = status === 'loading' || status === 'idle';

  return (
    <>
      <PageTitle
        eyebrow="CATALOG"
        title="Catalog"
        action={canAdd ? (
          <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>
            + New
          </button>
        ) : undefined}
      />

      <FilterBar>
        <div className="grid gap-4 sm:grid-cols-2">
          <FilterTextInput label="Name" value={nameFilter} onChange={(value) => { setNameFilter(value); setPage(1); }} placeholder="Filter name…" />
          <FilterSelect label="Status" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={statusOptions} />
        </div>
      </FilterBar>

      {successMessage && (
        <ResourceMessage kind="success">
          {successMessage}
          <button type="button" className={`${textButtonClass} ml-2`} onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </ResourceMessage>
      )}

      {status === 'failed' && (
        <ResourceMessage kind="error">
          {error}{' '}
          <button type="button" className={textButtonClass} onClick={() => void dispatch(fetchMachines())}>Retry</button>
        </ResourceMessage>
      )}

      {deleteTarget && mutationError && status !== 'failed' && (
        <div className={`${errorClass} mb-4`} role="alert">{mutationError}</div>
      )}

      {loading && <ResourceMessage kind="loading">Loading machines…</ResourceMessage>}

      {status === 'succeeded' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                {showActions && <th className={thClass}>Actions</th>}
                <th className={thClass}>Sr. No.</th>
                <th className={thClass}>Name</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Hourly price</th>
                <th className={thClass}>Currency</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={showActions ? 6 : 5}>No machines found.</td>
                </tr>
              )}
              {pageRows.map((machine, index) => (
                <tr key={machine.id} className="hover:bg-white/2">
                  {showActions && (
                    <td className={cellClass}>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {canEdit && <button type="button" className={textButtonClass} onClick={() => openEdit(machine)}>Edit</button>}
                        {canDelete && <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(machine)}>Delete</button>}
                      </div>
                    </td>
                  )}
                  <td className={cellClass}>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className={cellClass}>{machine.name}</td>
                  <td className={cellClass}>{machine.status}</td>
                  <td className={cellClass}>{machine.pricePerHourCents ?? '—'}</td>
                  <td className={cellClass}>{machine.currency ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TableFooter
            dense={dense}
            onDenseChange={setDense}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            totalRecords={filtered.length}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </section>
      )}

      <Modal
        open={dialogMode !== 'closed'}
        title={dialogMode === 'create' ? 'New machine' : 'Edit machine'}
        subtitle={dialogMode === 'edit' ? selected?.name : undefined}
        onClose={closeDialog}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={closeDialog}>Cancel</button>
            <button type="submit" form="machine-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={mutationStatus === 'loading'}>
              {mutationStatus === 'loading' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="machine-form" className="grid gap-4" onSubmit={(event) => void saveMachine(event)}>
          <label className={fieldClass}>
            Machine name *
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className={fieldClass}>
            Status *
            <Select value={statusValue} onChange={(event) => setStatusValue(event.target.value as MachineStatus)}>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="RETIRED">Retired</option>
            </Select>
          </label>
          <label className={fieldClass}>
            Hourly price (minor units) *
            <input
              className={inputClass}
              type="number"
              min={1}
              value={pricePerHourCents}
              onChange={(event) => setPricePerHourCents(event.target.valueAsNumber)}
              required
            />
          </label>
          <label className={fieldClass}>
            Currency *
            <input
              className={inputClass}
              value={currency}
              minLength={3}
              maxLength={3}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              required
            />
          </label>
          {mutationError && <div className={errorClass} role="alert">{mutationError}</div>}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete machine?"
        message="Are you sure you want to delete this record?"
        confirmLabel="Confirm"
        loading={mutationStatus === 'loading'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
